import type {InvokeResult} from './router.js';

export type VulnerabilitySignal =
	| 'SECURE'
	| 'POTENTIAL_VULN'
	| 'UNEXPECTED_ERROR'
	| 'TIMEOUT'
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
		case 'TIMEOUT':
			return 'LOW';
		case 'SIMULATION_FAIL':
			return 'LOW';
		case 'SECURE':
			return 'INFO';
	}
}

/**
 * Classifies an error message string into a vulnerability signal.
 *
 * Error taxonomy:
 *   - WasmVm / unreachable / vmtrap  → POTENTIAL_VULN (real WASM panic with type-correct input)
 *   - Auth / require_auth            → SECURE (expected auth rejection)
 *   - Contract error code            → SECURE (expected business-logic rejection)
 *   - Context / reserved function    → SECURE (expected for __check_auth and similar)
 *   - Anything else                  → UNEXPECTED_ERROR
 */
function classifyError(
	msg: string | null,
	code: string | null,
): {signal: VulnerabilitySignal; details: string} {
	const m = (msg ?? '').toLowerCase();

	// WASM panics — real vulnerability even with type-correct inputs
	if (m.includes('wasmvm') || m.includes('unreachable') || m.includes('vmtrap')) {
		return {
			signal: 'POTENTIAL_VULN',
			details: `WASM panic on type-correct input: ${msg ?? code}`,
		};
	}

	// Auth errors — expected for protected functions
	// Format from Soroban RPC: "Error(Auth, ...)" or "require_auth"
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

	// Host-level object error — typically "not a contract address" when a G... keypair
	// is passed where a contract address is expected.  Expected with random address inputs.
	if (m.includes('error(object,') || m.includes('not a contract address')) {
		return {
			signal: 'SECURE',
			details: `Host error (non-contract address, expected with random inputs): ${msg ?? code}`,
		};
	}

	// Context / reserved function errors
	if (m.includes('error(context,') || m.includes('reservedfunction') || m.includes('reserved function')) {
		return {
			signal: 'SECURE',
			details: `Reserved/context error (expected): ${msg ?? code}`,
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
 *   - failure → classify the error message; WASM panics are POTENTIAL_VULN
 *
 * Access control vectors (expectedToFail = true):
 *   - success → POTENTIAL_VULN (access bypass)
 *   - failure → SECURE if rejected for expected reasons (auth, contract error)
 *               POTENTIAL_VULN if it traps (WASM panic on an attack call is still interesting)
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
