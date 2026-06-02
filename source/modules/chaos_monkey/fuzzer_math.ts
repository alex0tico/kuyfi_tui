import {Keypair, Networks, xdr} from '@stellar/stellar-sdk';
import {rpc as SorobanRpc} from '@stellar/stellar-sdk';
import {invokeContract} from './router.js';
import {parseInvokeResult} from './result_parser.js';
import {baseline, attackVals} from './type_gen.js';
import type {UdtRegistry} from './type_gen.js';
import type {ParsedResult} from './result_parser.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTypeDef = any;

export interface FuzzTarget {
	contractId: string;
	functionName: string;
	params: Array<{name: string; type: AnyTypeDef}>;
	isAdminFunction: boolean;
}

export interface FuzzResult {
	target: FuzzTarget;
	vectorName: string;
	result: ParsedResult;
}

/**
 * One-variable-at-a-time fuzzer.
 *
 * For each parameter, generates type-correct attack values and submits one
 * invocation per vector while all other parameters hold a safe baseline value
 * of their own type. UDT struct params are constructed from the registry so
 * Vec<UDT> elements are real structs, not Void.
 *
 * Functions with zero parameters are skipped.
 */
export async function fuzzMathVectors(
	target: FuzzTarget,
	keypair: Keypair,
	server: SorobanRpc.Server,
	registry: UdtRegistry,
): Promise<FuzzResult[]> {
	if (target.params.length === 0) return [];

	const results: FuzzResult[] = [];
	const baselines: xdr.ScVal[] = target.params.map(p => baseline(p.type, registry));

	for (let i = 0; i < target.params.length; i++) {
		const param = target.params[i]!;
		const vectors = attackVals(param.type, registry);

		if (vectors.length === 0) continue; // direct UDT / unknown — skip param

		for (const vec of vectors) {
			const args = baselines.map((b, j) => (j === i ? vec.val : b));
			const vectorName = `${param.name}::${vec.name}`;

			const raw = await invokeContract({
				contractId: target.contractId,
				functionName: target.functionName,
				args,
				keypair,
				server,
				networkPassphrase: Networks.TESTNET,
			});

			const parsed = parseInvokeResult(
				raw,
				false,
				target.functionName,
				vectorName,
				target.isAdminFunction,
			);
			results.push({target, vectorName, result: parsed});
		}
	}

	return results;
}
