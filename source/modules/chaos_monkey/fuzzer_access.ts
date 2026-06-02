import {Address, Keypair, Networks, xdr} from '@stellar/stellar-sdk';
import {rpc as SorobanRpc} from '@stellar/stellar-sdk';
import {invokeContract} from './router.js';
import {parseInvokeResult} from './result_parser.js';
import {baseline} from './type_gen.js';
import type {FuzzTarget, FuzzResult} from './fuzzer_math.js';

const ADMIN_FUNCTION_PATTERNS = [
	'pause',
	'unpause',
	'initialize',
	'init',
	'setup',
	'upgrade',
	'set_admin',
	'set_pending_admin',
	'transfer_admin',
	'emergency',
];

const REINIT_FUNCTION_PATTERNS = ['initialize', 'init', 'setup'];
const SELF_CALL_FUNCTION_PATTERNS = ['set_admin', 'set_pending_admin', 'transfer_admin'];

export function isAdminFunctionByName(name: string): boolean {
	return ADMIN_FUNCTION_PATTERNS.some(pattern => name.toLowerCase().includes(pattern));
}

/**
 * Runs access control attack vectors against admin functions.
 *
 * All arguments use type-correct values derived from the param spec —
 * no void/wrong-type args that would fail at the simulation type-check
 * level rather than the auth level.
 *
 * UNAUTHORIZED_CALL and REINIT_ATTACK are expected to fail on a secure
 * contract (auth rejection).  SELF_CALL_ATTACK is expected to fail because
 * the attacker's address is not the admin.
 * POTENTIAL_VULN is reported if any of these attacks succeeds.
 */
export async function fuzzAccessVectors(
	target: FuzzTarget,
	keypair: Keypair,
	server: SorobanRpc.Server,
): Promise<FuzzResult[]> {
	const results: FuzzResult[] = [];
	const fnName = target.functionName.toLowerCase();
	const isAdmin = isAdminFunctionByName(target.functionName);
	const attackerAddrVal = new Address(keypair.publicKey()).toScVal();

	// 1. UNAUTHORIZED_CALL — call any admin function from a random (non-admin) keypair
	if (isAdmin) {
		const args = target.params.map(p => baseline(p.type));
		const raw = await invokeContract({
			contractId: target.contractId,
			functionName: target.functionName,
			args,
			keypair,
			server,
			networkPassphrase: Networks.TESTNET,
		});
		const parsed = parseInvokeResult(raw, true, target.functionName, 'UNAUTHORIZED_CALL', true);
		results.push({target, vectorName: 'UNAUTHORIZED_CALL', result: parsed});
	}

	// 2. REINIT_ATTACK — call init/setup on an already-initialised contract
	const isReinit = REINIT_FUNCTION_PATTERNS.some(p => fnName.includes(p));
	if (isReinit) {
		const args = target.params.map(p => baseline(p.type));
		const raw = await invokeContract({
			contractId: target.contractId,
			functionName: target.functionName,
			args,
			keypair,
			server,
			networkPassphrase: Networks.TESTNET,
		});
		const parsed = parseInvokeResult(raw, true, target.functionName, 'REINIT_ATTACK', true);
		results.push({target, vectorName: 'REINIT_ATTACK', result: parsed});
	}

	// 3. SELF_CALL_ATTACK — try to promote the attacker's address as admin.
	//    Address-typed params receive the attacker's address; all others get baseline.
	const isSelfCall = SELF_CALL_FUNCTION_PATTERNS.some(p => fnName === p);
	if (isSelfCall) {
		const args = target.params.map(p => {
			const isAddr = (p.type as xdr.ScSpecTypeDef).switch().name === 'scSpecTypeAddress';
			return isAddr ? attackerAddrVal : baseline(p.type);
		});
		const raw = await invokeContract({
			contractId: target.contractId,
			functionName: target.functionName,
			args,
			keypair,
			server,
			networkPassphrase: Networks.TESTNET,
		});
		const parsed = parseInvokeResult(raw, true, target.functionName, 'SELF_CALL_ATTACK', true);
		results.push({target, vectorName: 'SELF_CALL_ATTACK', result: parsed});
	}

	return results;
}
