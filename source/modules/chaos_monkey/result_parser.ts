import type {InvokeResult} from './router.js';

export type VulnerabilitySignal =
	| 'SECURE'
	| 'POTENTIAL_VULN'
	| 'UNCONTROLLED_PANIC'
	| 'UNEXPECTED_ERROR'
	| 'TIMEOUT'
	| 'PRECONDITION_FAIL'
	| 'SIMULATION_FAIL';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface ParsedResult {
	signal: VulnerabilitySignal;
	severity: Severity;
	details: string;
	rawErrorCode: string | null;
	functionName: string;
	vectorName: string;
}

export function signalToSeverity(signal: VulnerabilitySignal, isAdminFunction: boolean): Severity {
	switch (signal) {
		case 'POTENTIAL_VULN':
			return isAdminFunction ? 'CRITICAL' : 'HIGH';
		case 'UNCONTROLLED_PANIC':
			return 'MEDIUM';
		case 'UNEXPECTED_ERROR':
			return 'MEDIUM';
		case 'PRECONDITION_FAIL':
			return 'LOW';
		case 'TIMEOUT':
			return 'LOW';
		case 'SIMULATION_FAIL':
			return 'LOW';
		case 'SECURE':
			return 'INFO';
	}
}

/**
 * Error taxonomy for Soroban RPC error strings:
 *
 *   TX_FAILED (on-chain)                    → PRECONDITION_FAIL (passed simulation but failed on-chain;
 *                                              typically missing token balance or protocol state)
 *   Failed nested/cross-contract call in the
 *     event log (e.g. a token `transfer`)    → PRECONDITION_FAIL (the trap is a downstream symptom of a
 *                                              failed external call, not a bug in the contract under test)
 *   Error(Auth,) / require_auth             → PRECONDITION_FAIL (test account has no admin signer/allowance)
 *   REINIT_ATTACK / RANDOM_ADDR_* vector
 *     against an initialize/init/setup fn    → PRECONDITION_FAIL (expected: contract already initialized)
 *   WasmVm / unreachable / vmtrap,
 *     trap right after the function's own
 *     entry frame, no nested call recorded   → UNCONTROLLED_PANIC (MEDIUM) — the function panics instead of
 *                                              returning a clean Error(Contract,...) on invalid state; a
 *                                              robustness/error-handling finding, not a proven exploitable bug
 *   WasmVm / unreachable / vmtrap,
 *     with nested call frame(s) recorded
 *     before the trap                        → POTENTIAL_VULN  (real candidate vulnerability — the deeper
 *                                              trace means the panic isn't explained by an empty precondition
 *                                              check at function entry)
 *   Error(Contract,)                        → SECURE          (expected business-logic rejection)
 *   Error(Object,) / "not a contract"       → SECURE          (host error; expected with random address inputs)
 *   Error(Context,) / reserved              → SECURE          (reserved function, e.g. __check_auth)
 *   Error(Storage,)                         → UNEXPECTED_ERROR (function reached storage — note: verify auth precedes this)
 *   Anything else                           → UNEXPECTED_ERROR
 *
 * IMPORTANT: `msg` is the raw Soroban RPC error string, which for a failed
 * simulation already contains the full diagnostic event log as text (nested
 * fn_call frames into other contracts, "escalating error to VM trap from
 * failed host function call", etc). A bare "unreachable"/"vmtrap" substring
 * match is not enough to call something a vulnerability — that trap is
 * frequently the last line of a trace whose real cause, a few lines up, is a
 * failed call into another contract (e.g. a token transfer the ephemeral
 * fuzzing account has no balance/trustline/auth for). We must read the rest
 * of the event log before trusting the "unreachable" match.
 */
const INIT_FUNCTION_PATTERNS = ['initialize', 'init', 'setup'];

function classifyError(
	msg: string | null,
	code: string | null,
	vectorName: string,
	functionName: string,
): {signal: VulnerabilitySignal; details: string} {
	const m = (msg ?? '').toLowerCase();

	// On-chain failure that passed simulation — almost always a precondition issue
	// (missing token balance, non-admin signer, protocol state not set up)
	if (code === 'TX_FAILED') {
		return {
			signal: 'PRECONDITION_FAIL',
			details: `On-chain execution failed (simulation passed — likely missing token balance or protocol state, not a code vulnerability): ${msg ?? 'no details'}`,
		};
	}

	// A nested/cross-contract call failed before the trap — the event log shows
	// the contract under test calling out (typically a token `transfer`) and that
	// call failing, which then escalates into a VM trap. This is a precondition
	// issue with the fuzzing account (no balance/trustline/auth), not a
	// vulnerability in the contract under test.
	const hasFailedCrossContractCall =
		m.includes('contract call failed') ||
		(m.includes('escalating error') && (m.includes('vm trap') || m.includes('host function call'))) ||
		/fn_call[^\n]*transfer/i.test(msg ?? '');

	if (hasFailedCrossContractCall) {
		return {
			signal: 'PRECONDITION_FAIL',
			details: `Event log shows a failed nested/cross-contract call (e.g. a token transfer) before the trap — likely missing balance, trustline, or allowance on the test account, not a contract vulnerability: ${msg ?? code}`,
		};
	}

	// Auth errors — expected for a protected function called without a real
	// admin/authorized signer. Checked before the trap check below because an
	// auth failure can itself escalate into a VM trap deeper in the call.
	if (m.includes('error(auth,') || m.includes('require_auth') || m.includes('auth failed')) {
		return {
			signal: 'PRECONDITION_FAIL',
			details: `Auth check rejected the call — test account is not an authorized signer for this function: ${msg ?? code}`,
		};
	}

	// REINIT_ATTACK / RANDOM_ADDR_* vectors against initialize/init/setup are
	// expected to trap once the contract is already initialized.
	const isInitFunction = INIT_FUNCTION_PATTERNS.some(p => functionName.toLowerCase().includes(p));
	const isReinitVector = vectorName === 'REINIT_ATTACK' || vectorName.includes('RANDOM_ADDR');
	const looksLikeTrap = m.includes('wasmvm') || m.includes('unreachable') || m.includes('vmtrap');

	if (isInitFunction && isReinitVector && looksLikeTrap) {
		return {
			signal: 'PRECONDITION_FAIL',
			details: `${vectorName} trapped on ${functionName} — expected, contract is already initialized: ${msg ?? code}`,
		};
	}

	// WASM panics — every precondition cause above has been ruled out from the
	// event log, so this is either an uncontrolled panic or a real candidate
	// vulnerability, distinguished by how deep the call trace goes before the
	// trap fires:
	//   - exactly one fn_call frame (the function's own entry) → the trap
	//     fires right at/near entry with no nested call ever attempted. Almost
	//     always an unwrap()/assert() on missing state (e.g. empty pool
	//     reserves, already-initialized storage) rather than a proven
	//     exploitable bug — the function should have returned
	//     Error(Contract,...) instead of panicking. Flag as a robustness
	//     finding (UNCONTROLLED_PANIC/MEDIUM), not HIGH/CRITICAL.
	//   - more than one fn_call frame → the trap fired after real nested
	//     call/state activity was recorded, so an empty-precondition
	//     explanation doesn't fit — keep this as a genuine POTENTIAL_VULN
	//     candidate at full severity. Do not collapse the two cases.
	if (looksLikeTrap) {
		const fnCallFrames = (msg ?? '').match(/topics:\s*\[fn_call/gi)?.length ?? 0;

		if (fnCallFrames === 1) {
			return {
				signal: 'UNCONTROLLED_PANIC',
				details: `Function panics (VM trap) instead of returning a clean Error(Contract,...) on invalid state/precondition — the trap fires immediately after the function's own entry frame with no nested call recorded in the event log (e.g. unwrap()/assert() on empty pool reserves or already-initialized storage). This is a robustness/error-handling finding, not a proven exploitable vulnerability: ${msg ?? code}`,
			};
		}

		return {
			signal: 'POTENTIAL_VULN',
			details: `WASM panic on type-correct input, after ${fnCallFrames} nested call frame(s) recorded in the event log — no failed cross-contract call or auth rejection found to explain it: ${msg ?? code}`,
		};
	}

	// Contract-level business-logic errors — e.g. Error(Contract, #1) = AlreadyInitialized
	if (m.includes('error(contract,')) {
		return {
			signal: 'SECURE',
			details: `Contract validation rejected input: ${msg ?? code}`,
		};
	}

	// Host-level object error — typically "not a contract address" when G... keypair
	// is passed where a contract address is expected. Expected with random address inputs.
	if (m.includes('error(object,') || m.includes('not a contract address')) {
		return {
			signal: 'SECURE',
			details: `Host error (non-contract address, expected with random address inputs): ${msg ?? code}`,
		};
	}

	// Context / reserved function errors
	if (m.includes('error(context,') || m.includes('reservedfunction') || m.includes('reserved function')) {
		return {
			signal: 'SECURE',
			details: `Reserved/context error (expected): ${msg ?? code}`,
		};
	}

	// Storage errors — function reached a storage operation during simulation.
	// For admin functions (e.g. upgrade calling update_current_contract_wasm), this indicates
	// the function body was executed past any auth check — verify auth is enforced before
	// the storage operation that caused this error.
	if (m.includes('error(storage,')) {
		return {
			signal: 'UNEXPECTED_ERROR',
			details: `Function reached storage operation before failure — verify auth is enforced before this call: ${msg ?? code}`,
		};
	}

	return {
		signal: 'UNEXPECTED_ERROR',
		details: `Unexpected failure (code: ${code ?? 'unknown'}): ${msg ?? 'no details'}`,
	};
}

/**
 * Maps a raw InvokeResult to a structured ParsedResult.
 *
 * Math vectors (expectedToFail = false):
 *   - success → SECURE
 *   - TX_FAILED → PRECONDITION_FAIL (LOW) — simulation passed, on-chain state issue
 *   - other failure → classify the error message; WASM panics are POTENTIAL_VULN
 *     (deep call trace) or UNCONTROLLED_PANIC (trap right at function entry)
 *
 * Access control vectors (expectedToFail = true):
 *   - success → POTENTIAL_VULN (access bypass)
 *   - failure → SECURE if rejected for expected reasons; POTENTIAL_VULN /
 *     UNCONTROLLED_PANIC for WASM panics
 */
export function parseInvokeResult(
	result: InvokeResult,
	expectedToFail: boolean,
	functionName: string,
	vectorName: string,
	isAdminFunction: boolean,
): ParsedResult {
	if (result.errorCode === 'TIMEOUT') {
		return {
			signal: 'TIMEOUT',
			severity: 'LOW',
			details: 'Transaction did not confirm within the polling window',
			rawErrorCode: result.errorCode,
			functionName,
			vectorName,
		};
	}

	if (!result.success) {
		const classified = classifyError(result.errorMessage, result.errorCode, vectorName, functionName);

		if (expectedToFail) {
			// Access control vector: contract rejected the attack — SECURE unless it
			// was actually a WASM panic (POTENTIAL_VULN or UNCONTROLLED_PANIC)
			if (classified.signal === 'POTENTIAL_VULN' || classified.signal === 'UNCONTROLLED_PANIC') {
				return {
					signal: classified.signal,
					severity: signalToSeverity(classified.signal, isAdminFunction),
					details: classified.details,
					rawErrorCode: result.errorCode,
					functionName,
					vectorName,
				};
			}

			return {
				signal: 'SECURE',
				severity: 'INFO',
				details: classified.details,
				rawErrorCode: result.errorCode,
				functionName,
				vectorName,
			};
		}

		// Math vector: contract failed on a type-correct input — classify why
		return {
			signal: classified.signal,
			severity: signalToSeverity(classified.signal, isAdminFunction),
			details: classified.details,
			rawErrorCode: result.errorCode,
			functionName,
			vectorName,
		};
	}

	// Transaction succeeded
	if (expectedToFail) {
		return {
			signal: 'POTENTIAL_VULN',
			severity: signalToSeverity('POTENTIAL_VULN', isAdminFunction),
			details: `${vectorName}: access control bypass — call was NOT rejected on ${functionName}`,
			rawErrorCode: null,
			functionName,
			vectorName,
		};
	}

	return {
		signal: 'SECURE',
		severity: 'INFO',
		details: `${vectorName}: accepted gracefully by ${functionName}`,
		rawErrorCode: null,
		functionName,
		vectorName,
	};
}
