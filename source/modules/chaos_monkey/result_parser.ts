import type {InvokeResult} from './router.js';

export type VulnerabilitySignal =
	| 'SECURE'
	| 'POTENTIAL_VULN'
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
 *   WasmVm / unreachable / vmtrap     → POTENTIAL_VULN  (real WASM panic with type-correct input)
 *   Error(Auth,) / require_auth       → SECURE          (expected auth rejection)
 *   Error(Contract,)                  → SECURE          (expected business-logic rejection)
 *   Error(Object,) / "not a contract" → SECURE          (host error; expected with random address inputs)
 *   Error(Context,) / reserved        → SECURE          (reserved function, e.g. __check_auth)
 *   Error(Storage,)                   → UNEXPECTED_ERROR (function reached storage — note: verify auth precedes this)
 *   TX_FAILED (on-chain)              → PRECONDITION_FAIL (passed simulation but failed on-chain;
 *                                       typically missing token balance or protocol state)
 *   Anything else                     → UNEXPECTED_ERROR
 */
function classifyError(
	msg: string | null,
	code: string | null,
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

	// WASM panics — real vulnerability even with type-correct inputs
	if (m.includes('wasmvm') || m.includes('unreachable') || m.includes('vmtrap')) {
		return {
			signal: 'POTENTIAL_VULN',
			details: `WASM panic on type-correct input: ${msg ?? code}`,
		};
	}

	// Auth errors — expected for protected functions
	if (m.includes('error(auth,') || m.includes('require_auth') || m.includes('auth failed')) {
		return {
			signal: 'SECURE',
			details: `Auth check (expected for protected function): ${msg ?? code}`,
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
 *
 * Access control vectors (expectedToFail = true):
 *   - success → POTENTIAL_VULN (access bypass)
 *   - failure → SECURE if rejected for expected reasons; POTENTIAL_VULN for WASM panics
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
		const classified = classifyError(result.errorMessage, result.errorCode);

		if (expectedToFail) {
			// Access control vector: contract rejected the attack — SECURE unless WASM panic
			if (classified.signal === 'POTENTIAL_VULN') {
				return {
					signal: 'POTENTIAL_VULN',
					severity: signalToSeverity('POTENTIAL_VULN', isAdminFunction),
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
