# Roadmap

## Phase 1 — OSINT Scanner

**Status: Stable**

- [x] Fetch WASM bytecode from any Soroban Testnet contract via RPC
- [x] Alignment-tolerant XDR parse of `contractspecv0` custom section
- [x] UDT struct registry built from `scSpecEntryUdtStructV0` entries
- [x] Attack surface map rendered in terminal (functions, typed params, return types)
- [x] Terminal-resize-safe TUI (Ink + React)
- [x] Keyboard navigation: `↑↓`, `1–4`, `Esc`

---

## Phase 2 — Chaos Monkey

**Status: Beta / In Testing**

The engine is fully developed and integrated into the TUI. Testing is ongoing against DeFi protocol contracts on Stellar Testnet.

- [x] Ephemeral keypair generation + Friendbot funding + on-chain confirmation
- [x] Type-aware math boundary attacks (ZERO, MAX_VALUE, NEGATIVE, MIN_BOUNDARY)
- [x] One-variable-at-a-time fuzzing with type-correct baselines for all other params
- [x] Access control vectors: UNAUTHORIZED_CALL, REINIT_ATTACK, SELF_CALL_ATTACK
- [x] Admin function pattern detection
- [x] Full on-chain execution: simulate → assemble → sign → submit → poll
- [x] Error taxonomy: WASM panics, auth errors, contract errors, storage errors
- [x] Severity classification: CRITICAL / HIGH / MEDIUM / LOW / INFO
- [x] Terminal report with sequential finding IDs (KYF-001…)
- [ ] Stabilize across a broader range of contract patterns

---

## Phase 3 — Audit Reports and Integrations

**Status: Planned**

- [ ] Export findings as structured JSON
- [ ] Export findings as PDF (audit-ready format)
- [ ] CI/CD integration — run Kuyfi as a pipeline step
- [ ] Batch scanning of multiple contracts in one session
- [ ] Monitoring dashboard — track contract findings over time
- [ ] **kuyfi.io** — SaaS platform with hosted scanning and report delivery
- [ ] Formal security certification process for scanned contracts

---

## Notes

Phases 1 and 2 operate exclusively on Stellar Testnet. Mainnet support is a Phase 3 consideration and will be introduced only alongside appropriate responsible-use controls.
