# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.0] — 2026-06-09

### Added

- **OSINT Scanner (Phase 1 — Stable)**
  - Fetch WASM bytecode from any Soroban Testnet contract via `getContractWasmByContractId`
  - Alignment-tolerant XDR parse of `contractspecv0` custom section
  - UDT struct registry built from `scSpecEntryUdtStructV0` entries
  - Attack surface map: function names, typed parameter list, return type
  - Input validation (56-char Contract ID starting with C)

- **Chaos Monkey (Phase 2 — Beta)**
  - Ephemeral keypair generation and Friendbot funding with on-chain confirmation
  - Type-aware math boundary fuzzer: ZERO, MAX_VALUE, NEGATIVE, MIN_BOUNDARY attacks
  - One-variable-at-a-time strategy with type-correct baseline values for other params
  - Access control fuzzer: UNAUTHORIZED_CALL, REINIT_ATTACK, SELF_CALL_ATTACK vectors
  - Admin function detection by name pattern
  - Full transaction lifecycle: simulate → assemble → sign → submit → poll
  - Error taxonomy: classifies WASM panics, auth errors, contract errors, storage errors, host errors
  - `PRECONDITION_FAIL` signal for TX_FAILED cases (simulation passed, on-chain state issue)
  - Severity classification: CRITICAL / HIGH / MEDIUM / LOW / INFO
  - Terminal report with sequential finding IDs (KYF-001…), sorted by severity
  - UDT struct support in both fuzzers via type_gen registry

- **TUI**
  - React + Ink terminal UI with SPA-style state routing
  - Four modules: OSINT Scanner, Chaos Monkey, System Logs, About
  - Keyboard navigation: `↑↓`, number shortcuts `1–4`, `Esc` to return
  - Terminal-resize-safe re-render (clears Ink cascade artifact on resize)
  - `[C]` shortcut from Scanner results to launch Chaos Monkey on the same contract
  - Responsive ASCII header (compact layout for narrow terminals)
