# Contributing

## Development setup

**Requirements:** Node.js ≥ 18, npm.

```bash
# 1. Clone the repo
git clone https://github.com/alex0tico/kuyfi_tui.git
cd kuyfi_tui

# 2. Install TUI dependencies
npm install

# 3. Build the Soroban client bindings (required before running the TUI)
cd src/kuyfi_client
npm install
npm run build
cd ../..
```

## Running the TUI in development

Open two terminal tabs:

```bash
# Tab 1 — watch TypeScript and recompile on save
npm run dev

# Tab 2 — run the compiled output
npm start
```

Changes to `source/*.tsx` and `source/modules/**/*.ts` are recompiled automatically by the TypeScript watcher. Restart `npm start` after each recompile to pick up the new output.

## Project structure

```
kuyfi_tui/
├── source/
│   ├── cli.tsx                        # Entry point — terminal resize manager
│   ├── app.tsx                        # TUI router + Scanner and Chaos Monkey views
│   └── modules/
│       └── chaos_monkey/
│           ├── index.ts               # Orchestrator — runChaosMonkey()
│           ├── keypair_factory.ts     # Ephemeral keypair + Friendbot funding
│           ├── fuzzer_math.ts         # Math boundary fuzzer
│           ├── fuzzer_access.ts       # Access control fuzzer
│           ├── router.ts              # Transaction lifecycle (simulate → submit → poll)
│           ├── result_parser.ts       # Error taxonomy → VulnerabilitySignal
│           ├── reporter.ts            # ChaosReport builder + terminal formatter
│           └── type_gen.ts            # Type-aware ScVal generator
├── src/
│   └── kuyfi_client/                  # Auto-generated Soroban contract bindings
├── docs/
│   ├── demo.gif                       # Animated demo
│   ├── demo.md                        # Step-by-step walkthrough
│   ├── chaos-monkey.md                # Fuzzing engine documentation
│   └── assets/                        # Screenshots
├── ARCHITECTURE.md
├── ROADMAP.md
├── CHANGELOG.md
└── README.md
```

## Code conventions

- TypeScript throughout — no `any` beyond existing `AnyTypeDef` aliases in the scanner (XDR types are untyped by design).
- No comments except where the WHY is non-obvious.
- Ink components receive only what they need via props — no context or global state.

## Opening a pull request

1. Fork the repository and create a branch from `main`.
2. Make your changes. Keep PRs focused — one concern per PR.
3. Run `npm test` to verify formatting and linting pass.
4. Open a pull request against `main` with a clear description of what changed and why.

Bug reports and feature ideas are welcome as GitHub Issues.

## Testing against Testnet

The Chaos Monkey submits real transactions to Stellar Testnet. Friendbot provides test XLM automatically. You do not need a funded account of your own to run the fuzzer, but you do need a live internet connection to `soroban-testnet.stellar.org`.

Only test against contracts you own or have explicit authorization to test.
