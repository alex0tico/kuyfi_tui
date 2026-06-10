```text
      /\_/\               __ __  __  __  __  __  ____  ____               /\_/\
     ( o.o )             / // / / / / /  \ \/ / / __/ /  _/              ( o.o )
      > ^ <             / ,<   / /_/ /    \  / / _/  _/ /                 > ^ <
     /     \           /_/|_|  \____/     /_/ /_/   /___/                /     \
    (|     |)                                                           (|     |)
     \_____/                  [ CORE SECURITY MODULE ]                   \_____/
```

# Kuyfi — Black-Box Security Terminal for Soroban

> The first black-box smart contract security scanner native to Soroban. No source code required.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](./LICENSE)
[![npm version](https://img.shields.io/badge/npm-v0.0.0-gray?style=flat-square)](https://www.npmjs.com/package/kuyfi_tui)
[![Phase 1: OSINT Scanner — Stable](https://img.shields.io/badge/Phase%201-OSINT%20Scanner%20%E2%80%94%20Stable-C71585?style=flat-square)](#phase-1-osint-scanner--stable)
[![Phase 2: Chaos Monkey — Beta](https://img.shields.io/badge/Phase%202-Chaos%20Monkey%20%E2%80%94%20Beta-F59E0B?style=flat-square)](#phase-2-chaos-monkey--beta-in-testing)
[![Network: Stellar Testnet](https://img.shields.io/badge/Network-Stellar%20Testnet-8B5CF6?style=flat-square)](https://developers.stellar.org/docs/networks)
[![Stack: TypeScript + Ink + Soroban SDK](https://img.shields.io/badge/Stack-TypeScript%20%2B%20Ink%20%2B%20Soroban%20SDK-2563EB?style=flat-square)](https://docs.stellar.org/docs/smart-contracts/getting-started)

---

## What is Kuyfi?

Most security tools for Soroban (Veridise, Certora) require the original Rust source code. Kuyfi works directly on **deployed contracts** by fetching and decoding WASM bytecode on-chain — no source, no internal access needed.

Think of it as an **audit-readiness tool**: developers run Kuyfi before paying for a formal audit so they arrive at Veridise or Ottersec with obvious, surface-level issues already identified and fixed.

**Suggested workflow:**
```
run Kuyfi → fix obvious issues → submit to Audit Bank with a cleaner baseline
```

---

## Features

### Phase 1: OSINT Scanner — Stable

The OSINT module maps the attack surface using purely on-chain data.

| Feature | Status |
|---|---|
| Fetch WASM bytecode from any Testnet contract ID | ✅ Stable |
| XDR decode `contractspecv0` section (alignment-tolerant parser) | ✅ Stable |
| Build UDT struct registry from `scSpecEntryUdtStructV0` entries | ✅ Stable |
| Render attack surface map: function names, input types, return types | ✅ Stable |

### Phase 2: Chaos Monkey — Beta (In Testing)

The Chaos Monkey module is fully developed and integrated as a first-class TUI menu item. It is currently being tested against real DeFi protocol contracts on Stellar Testnet.

| Feature | Status |
|---|---|
| Ephemeral keypair generation + Friendbot funding | ✅ Developed |
| Type-aware math boundary attacks (one-variable-at-a-time) | ✅ Developed |
| Access control attacks on admin-pattern functions | ✅ Developed |
| Full on-chain execution: simulate → assemble → sign → submit → poll | ✅ Developed |
| Error taxonomy and severity classification (CRITICAL / HIGH / MEDIUM / LOW) | ✅ Developed |
| Terminal report with sequential finding IDs (KYF-001…) | ✅ Developed |
| Stable for general use | 🔶 In Testing |

---

## Demo

**Screen recording (GIF):**

![Kuyfi OSINT Scanner Demo](./docs/demo.gif)

> Scanning a live AMM contract on Stellar Testnet — no source code needed.

**Screenshots:** see [`docs/assets/`](./docs/assets/)

**Step-by-step walkthrough:** [`docs/demo.md`](./docs/demo.md)

---

## Installation

**Requirements:** Node.js ≥ 18, npm, internet access to Stellar Testnet.

```bash
# 1. Clone and install TUI dependencies
git clone https://github.com/alex0tico/kuyfi_tui.git
cd kuyfi_tui
npm install

# 2. Build the auto-generated Soroban client bindings
cd src/kuyfi_client
npm install
npm run build
cd ../..

# 3. Compile TypeScript
npm run build
```

---

## Usage

Launch the security terminal:

```bash
npm start
```

The TUI opens with a four-item menu. All navigation is keyboard-driven:

| Key | Action |
|---|---|
| `↑` / `↓` | Navigate menu |
| `1` – `4` | Jump to module directly |
| `Enter` | Select module |
| `Esc` | Back to menu |

**Modules:**

| # | Module | Description |
|---|---|---|
| 1 | OSINT Scanner | Enter a Contract ID → fetch bytecode → render attack surface map |
| 2 | Chaos Monkey | Run after Scanner to fuzz the loaded contract |
| 3 | System Logs | RPC connection status |
| 4 | About | Version and project info |

**Typical session:**

```
[1] OSINT Scanner
    → Enter Contract ID (56 chars, starts with C)
    → View attack surface map
    → Press [C] to launch Chaos Monkey on the same contract

[2] Chaos Monkey (loaded from Scanner)
    → Press [Enter] to start fuzzing
    → Watch live progress stream
    → Read findings report (KYF-001, KYF-002…)
```

---

## How It Works

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for a full component breakdown and data-flow diagram.

For a deep dive into the fuzzing engine, see [`docs/chaos-monkey.md`](./docs/chaos-monkey.md).

---

## Roadmap

See [`ROADMAP.md`](./ROADMAP.md) for the full plan.

| Phase | Description | Status |
|---|---|---|
| Phase 1 | OSINT Scanner — WASM extraction, XDR decode, attack surface map | ✅ Stable |
| Phase 2 | Chaos Monkey — math boundary + access control fuzzing | 🔶 Beta / In Testing |
| Phase 3 | Audit Reports — JSON/PDF export, CI/CD integration, monitoring dashboard | 📋 Planned |

---

## Responsible Use

Kuyfi sends **real on-chain transactions** to Stellar Testnet. Always:

- Run only against contracts you own or have explicit written authorization to test.
- Use Testnet only — never point at Mainnet contracts without the contract owner's consent.
- The fuzzer never stores, logs, or transmits private keys. Keypairs are generated ephemerally in memory and discarded after each session.

Unauthorized fuzzing of third-party contracts is a violation of their terms of service and may be illegal in your jurisdiction.

---

## Open-Core Model

The Kuyfi engine (OSINT Scanner + Chaos Monkey TUI) is **free and open-source** under the MIT license.

Advanced features — PDF audit reports, CI/CD pipeline integration, multi-contract batch scanning, a monitoring dashboard, and the upcoming **kuyfi.io** SaaS platform — are planned as paid tiers. Revenue from these tiers funds continued development of the free core.

---

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for development setup, how to run the TUI locally, and how to open a pull request.

---

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md).

---

## License

MIT — see [`LICENSE`](./LICENSE).

---

## About — Kuyfi and the Stellar Ecosystem

The **Soroban Audit Bank** (Veridise, Ottersec, CoinFabrik, and peers) delivers expert human audits, but those engagements typically require source code and budget. Kuyfi is the **missing layer before formal audits**: automated, black-box, and CLI-native — so you can profile a live contract the same way you would probe a closed binary.

Kuyfi runs entirely on Stellar Testnet infrastructure and is built with the official `@stellar/stellar-sdk`. It is not affiliated with the Stellar Development Foundation.

```
github.com/alex0tico/kuyfi_tui
```
