```text
      /\_/\               __ __  __  __  __  __  ____  ____               /\_/\
     ( o.o )             / // / / / / /  \ \/ / / __/ /  _/              ( o.o )
      > ^ <             / ,<   / /_/ /    \  / / _/  _/ /                 > ^ <
     /     \           /_/|_|  \____/     /_/ /_/   /___/                /     \
    (|     |)                                                           (|     |)
     \_____/                  [ CORE SECURITY MODULE ]                   \_____/
```

# Kuyfi Core - Security Terminal (TUI)

Official Terminal User Interface (TUI) for real-time interaction and monitoring of the Kuyfi smart contract on the Stellar network (Soroban). This tool provides tactical telemetry, state reading, and visual auditing directly from the command line.

## The Impact in Web3 Security

In the Web3 ecosystem, smart contracts are immutable and often handle millions of dollars in value. However, security tools are usually complex or require access to the original source code.

Kuyfi changes the game by acting as an offensive SecOps terminal directly from the CLI. It democratizes smart contract auditing on the Stellar network by allowing security researchers to map the attack surface of any deployed contract in real-time, extracting the WASM bytecode and decoding its XDR structure on the fly—without needing the original Rust code. It lays the groundwork for automated black-box testing and chaos engineering in Web3.

## Current Capabilities (Phase 1: OSINT Scanner)

The first active module of Kuyfi focuses on mapping the attack surface using purely on-chain data:

- **WASM Extraction:** Connects to the Stellar RPC to pull the compiled `.wasm` binary of any valid Contract ID.

- **XDR Telemetry:** Performs low-level memory fuzzing to decode the `contractspecv0` section directly from the buffer.

- **Surface Mapping:** Visually renders the contract's endpoints, parsing all function names, expected inputs, and output types into an actionable, human-readable terminal table.

## Architecture and Technical Concepts

This project implements a modern Web3 architecture by separating the interface logic from the blockchain logic:

- **Visual Engine (React + Ink):** Utilizes React to manage state and data lifecycles, rendering visual components directly in the standard terminal using the `ink` library.

- **Web3 Connectivity:** Implements auto-generated Soroban bindings and `stellar-sdk` to establish an RPC bridge with the Stellar Testnet.

- **SPA Terminal Navigation:** Implements a state-based router allowing seamless navigation between SecOps modules (OSINT Scanner, Chaos Monkey) without tearing down the Node.js process.

- **Strict Typing:** Built on TypeScript to ensure type safety in blockchain responses prior to rendering.

## ⚙️ Prerequisites

To run this terminal in a local environment, you need:

- Node.js (v18 or higher recommended)

- npm (Node Package Manager)

- Internet access for the RPC connection to the Stellar Testnet

## 🚀 Usage and Deployment Instructions

### 1. Installation

Clone the repository and install the Node dependencies:

```bash
git clone https://github.com/alex0tico/kuyfi_tui.git
cd kuyfi_tui
npm install
```

### 2. Web3 Client Configuration

Before running the interface, it is necessary to build the auto-generated Soroban client so that Node.js can process the bindings:

```bash
cd src/kuyfi_client
npm install
npm run build
cd ../..
```

### 3. Running the Terminal

You can launch the dashboard in your terminal by running the following commands from the project root (`kuyfi_tui`):

```bash
npm run dev
# (In another terminal tab, run the interface with:)
npm start
```

To exit the terminal and return to your standard command line, press `Esc` to return to the menu, or `Ctrl + C`.
