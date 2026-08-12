import {rpc as SorobanRpc, xdr} from '@stellar/stellar-sdk';
import {runChaosMonkey, formatReportForTerminal} from './dist/modules/chaos_monkey/index.js';
import {typeName} from './dist/modules/chaos_monkey/type_gen.js';

const contractId = 'CCSJ3REOFONMUJUINMZWBL45UXJYFXVFSXAWINLTDKFNEYBCRR4VF2Q2';

async function scan(contractId) {
	const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
	const wasmBytecode = await server.getContractWasmByContractId(contractId);
	if (!wasmBytecode || wasmBytecode.length === 0) {
		throw new Error('CONTRACT_NOT_FOUND');
	}

	const wasmModule = await WebAssembly.compile(Uint8Array.from(wasmBytecode));
	const [specSection] = WebAssembly.Module.customSections(wasmModule, 'contractspecv0');
	if (!specSection) {
		throw new Error('XDR_ALIGN_FAILURE');
	}

	const buffer = Buffer.from(specSection);
	let offset = 0;
	const entries = [];
	while (offset < buffer.length) {
		let success = false;
		for (let len = 4; len <= buffer.length - offset; len += 4) {
			try {
				const chunk = buffer.slice(offset, offset + len);
				const entry = xdr.ScSpecEntry.fromXDR(chunk);
				entries.push(entry);
				offset += len;
				success = true;
				break;
			} catch {}
		}
		if (!success) throw new Error('XDR_ALIGN_FAILURE');
	}

	const udtRegistry = new Map();
	for (const e of entries) {
		if (e.switch().name === 'scSpecEntryUdtStructV0') {
			const s = e.udtStructV0();
			const udtName = s.name().toString('utf-8');
			const fields = s.fields().map(f => ({
				name: f.name().toString('utf-8'),
				type: f.type(),
			}));
			udtRegistry.set(udtName, fields);
		}
	}

	const functions = entries
		.filter(e => e.switch().name === 'scSpecEntryFunctionV0')
		.map(e => {
			const func = e.functionV0();
			const inputSpecs = func.inputs().map(i => ({
				name: i.name().toString('utf-8'),
				type: i.type(),
			}));
			return {name: func.name().toString('utf-8'), params: inputSpecs};
		});

	return {functions, udtRegistry};
}

const {functions, udtRegistry} = await scan(contractId);
console.log(`Discovered ${functions.length} functions:`, functions.map(f => f.name).join(', '));

const report = await runChaosMonkey({
	contractId,
	functions,
	udtRegistry,
	onProgress: msg => console.log(`[progress] ${msg}`),
});

console.log(formatReportForTerminal(report));
console.log('\n--- RAW SUMMARY JSON ---');
console.log(JSON.stringify(report.summary, null, 2));
