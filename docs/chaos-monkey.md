# Chaos Monkey — Fuzzing Engine

The Chaos Monkey is Kuyfi's automated black-box fuzzer for Soroban smart contracts. It requires no source code — it works from the function spec recovered by the OSINT Scanner.

---

## Overview

A fuzzing session:

1. Generates an ephemeral Stellar keypair and funds it via Friendbot (Testnet only).
2. Confirms the account exists on-chain before proceeding.
3. For each contract function discovered by the Scanner:
   - Runs **math boundary vectors** (if the function has parameters).
   - Runs **access control vectors** (if the function name matches an admin pattern).
4. Builds a `ChaosReport` and displays it in the terminal.

All vectors are submitted as real signed on-chain transactions. No simulation-only mode exists — simulation is used to obtain the execution footprint, and the transaction is always broadcast.

---

## Math boundary vectors

**Module:** `fuzzer_math.ts`

**Strategy:** one-variable-at-a-time (OAT)

For each parameter in the function:
- All other parameters receive a **type-correct baseline** value (zero equivalent for their type).
- The targeted parameter receives each **attack value** in sequence.

This isolates which specific input causes a contract to misbehave.

**Attack values generated per numeric type (`i128`, `u32`, etc.):**

| Vector name | Value |
|---|---|
| `ZERO_ATTACK` | 0 |
| `MAX_VALUE_ATTACK` | Maximum representable value (e.g. `i128::MAX`) |
| `NEGATIVE_ATTACK` | -1 (or minimum negative, for signed types) |
| `MIN_BOUNDARY_ATTACK` | Smallest positive value (e.g. 1) |

**What a secure contract does:** accept or gracefully reject these inputs with a proper contract-level error (e.g. `AlreadyInitialized`, `InsufficientFunds`). A WASM panic (`unreachable`, `vmtrap`) on a type-correct input is flagged as `POTENTIAL_VULN`.

**Functions with zero parameters are skipped.**

---

## Access control vectors

**Module:** `fuzzer_access.ts`

The fuzzer detects admin functions by name pattern. A function is treated as admin if its lowercase name contains any of:

```
pause, unpause, initialize, init, setup, upgrade,
set_admin, set_pending_admin, transfer_admin, emergency
```

Three vectors run against admin functions:

### UNAUTHORIZED_CALL

Call any admin-pattern function from the random ephemeral keypair (which is not the contract admin). The expected result is rejection with an auth error. If the call **succeeds**, the contract has a missing authorization check — `POTENTIAL_VULN`.

### REINIT_ATTACK

Call functions matching `initialize`, `init`, or `setup` on an already-deployed, already-initialized contract. A correct implementation should return an error like `AlreadyInitialized`. If the call succeeds, the contract can be re-initialized — `POTENTIAL_VULN` at CRITICAL severity.

### SELF_CALL_ATTACK

Call `set_admin`, `set_pending_admin`, or `transfer_admin` with the attacker's own address in every address-typed parameter. This tests whether the contract enforces that only the current admin can promote a new one. Success is `POTENTIAL_VULN`.

---

## Transaction lifecycle

**Module:** `router.ts`

Every attack vector follows this flow:

```
getAccount(keypair.publicKey())
  └─ TransactionBuilder.build()
       └─ simulateTransaction()          ← read-only; obtains footprint and auth
            ├─ (simulation error)  ──→  SIMULATION_FAIL result
            └─ assembleTransaction()
                 └─ sign with keypair
                      └─ sendTransaction()     ← writes to Testnet
                           └─ poll getTransaction() every 1 s (up to 20 attempts)
                                ├─ SUCCESS  ──→  return resultValue
                                ├─ FAILED   ──→  TX_FAILED
                                └─ (20 attempts) ──→  TIMEOUT
```

The function never throws — all error paths are caught and returned as a typed `InvokeResult`.

---

## Error taxonomy and classification

**Module:** `result_parser.ts`

The fuzzer classifies each outcome using the error message and error code returned from the RPC:

| Error pattern | Signal | Reasoning |
|---|---|---|
| `WasmVm` / `unreachable` / `vmtrap` | `POTENTIAL_VULN` | Real WASM panic on a type-correct input |
| `Error(Auth,)` / `require_auth` / `auth failed` | `SECURE` | Expected auth rejection |
| `Error(Contract,)` | `SECURE` | Expected business-logic rejection (e.g. AlreadyInitialized) |
| `Error(Object,)` / `not a contract address` | `SECURE` | Host-level error; expected when a random address is passed where a contract address is needed |
| `Error(Context,)` / reserved function | `SECURE` | Reserved function (e.g. `__check_auth`) |
| `Error(Storage,)` | `UNEXPECTED_ERROR` | Function reached a storage operation — verify that auth is enforced before this point |
| `TX_FAILED` (on-chain, simulation passed) | `PRECONDITION_FAIL` | Not a code vulnerability; fuzzer's account lacked required token balance or protocol state |
| Anything else | `UNEXPECTED_ERROR` | Unclassified failure |

**Access control vectors** are `expectedToFail = true`. For these, if the contract **rejects** the call (any reason except WASM panic), the result is `SECURE`. If the call **succeeds**, it is `POTENTIAL_VULN`.

---

## Severity escalation

| Signal | Admin function | Non-admin function |
|---|---|---|
| `POTENTIAL_VULN` | **CRITICAL** | HIGH |
| `UNEXPECTED_ERROR` | MEDIUM | MEDIUM |
| `PRECONDITION_FAIL` | LOW | LOW |
| `TIMEOUT` | LOW | LOW |
| `SIMULATION_FAIL` | LOW | LOW |
| `SECURE` | INFO | INFO |

---

## Report format

**Module:** `reporter.ts`

After all vectors complete, `buildReport()` produces a `ChaosReport` with:

- Contract ID, scan timestamp, network.
- Total functions scanned and total vectors run.
- Summary counters: CRITICAL, HIGH, MEDIUM, LOW, PRECONDITION_FAIL, INFO.
- Findings list: only non-SECURE, non-PRECONDITION_FAIL results appear here. Each finding has a sequential ID (`KYF-001`, `KYF-002`, …), severity, function name, vector name, and detail string. Sorted by severity (CRITICAL first).

---

## Responsible use

- **Only fuzz contracts you own or are authorized to test.** The fuzzer submits real on-chain transactions.
- The ephemeral keypair is generated fresh each session and is never persisted to disk.
- All activity is on Stellar Testnet. Mainnet support does not exist in the current version.
- `PRECONDITION_FAIL` findings are typically benign — they mean the test couldn't meet a protocol precondition (e.g. token balance), not that the contract has a vulnerability.
