import {rpc as SorobanRpc} from '@stellar/stellar-sdk';
import {generateEphemeralKeypair} from './keypair_factory.js';
import {fuzzMathVectors} from './fuzzer_math.js';
import {fuzzAccessVectors, isAdminFunctionByName} from './fuzzer_access.js';
import {buildReport} from './reporter.js';
import type {FuzzTarget, FuzzResult} from './fuzzer_math.js';
import type {ChaosReport} from './reporter.js';

export type {ChaosReport} from './reporter.js';
export type {Finding} from './reporter.js';
export {formatReportForTerminal} from './reporter.js';
export type {FuzzResult} from './fuzzer_math.js';
export type {ParsedResult} from './result_parser.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTypeDef = any;

const RPC_URL = 'https://soroban-testnet.stellar.org';

export interface ChaosMonkeyOptions {
	contractId: string;
	functions: Array<{
		name: string;
		params: Array<{name: string; type: AnyTypeDef}>;
	}>;
	onProgress: (message: string) => void;
}

/**
 * Runs the complete Chaos Monkey session against a Soroban contract.
 *
 * 1. Generates an ephemeral keypair and funds it via Friendbot
 * 2. Connects to Testnet RPC
 * 3. For each discovered function: runs type-aware math + access fuzzers
 * 4. Builds and returns the final ChaosReport
 */
export async function runChaosMonkey(options: ChaosMonkeyOptions): Promise<ChaosReport> {
	const {contractId, functions, onProgress} = options;

	onProgress('Generating ephemeral keypair...');
	const keypair = await generateEphemeralKeypair();
	onProgress(`Keypair funded: ${keypair.publicKey().slice(0, 10)}...`);

	const server = new SorobanRpc.Server(RPC_URL);
	onProgress(`Connected to RPC: ${RPC_URL}`);
	onProgress(`Starting fuzzing session on ${functions.length} function(s)...`);

	const allResults: FuzzResult[] = [];

	for (const fn of functions) {
		const target: FuzzTarget = {
			contractId,
			functionName: fn.name,
			params: fn.params,
			isAdminFunction: isAdminFunctionByName(fn.name),
		};

		const fuzzableParams = fn.params.filter(p => {
			const tname: string = p.type.switch().name;
			return !['scSpecTypeUdt', 'scSpecTypeResult', 'scSpecTypeTuple', 'scSpecTypeMap'].includes(tname);
		});

		onProgress(`[${fn.name}] Running math vectors (${fuzzableParams.length} fuzzable params)...`);
		try {
			const mathResults = await fuzzMathVectors(target, keypair, server);
			allResults.push(...mathResults);
			onProgress(`[${fn.name}] Math done (${mathResults.length} invocations)`);
		} catch (error) {
			onProgress(
				`[${fn.name}] Math fuzzer error: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		if (target.isAdminFunction) {
			onProgress(`[${fn.name}] Running access control vectors...`);
			try {
				const accessResults = await fuzzAccessVectors(target, keypair, server);
				allResults.push(...accessResults);
				onProgress(`[${fn.name}] Access done (${accessResults.length} invocations)`);
			} catch (error) {
				onProgress(
					`[${fn.name}] Access fuzzer error: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	}

	onProgress('Building report...');
	const report = buildReport(contractId, allResults);

	onProgress(
		`Scan complete — ${report.findings.length} finding(s) | ` +
			`CRITICAL: ${report.summary.critical} HIGH: ${report.summary.high}`,
	);

	return report;
}
