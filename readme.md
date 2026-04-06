      /\_/\
     ( o.o )
      > ^ <
     /     \
    (|     |)
     \_____/

```diff
+    __ __  __  __  __  __  ____  ____
+   / // / / / / /  \ \/ / / __/ /  _/
+  / ,<   / /_/ /    \  / / _/  _/ /  
+ /_/|_|  \____/     /_/ /_/   /___/  
+                                     
+ CORE SECURITY MODULE                  
```
# Kuyfi Core - Security Terminal (TUI)

Official Terminal User Interface (TUI) for real-time interaction and monitoring of the Kuyfi smart contract on the Stellar network (Soroban). This tool provides tactical telemetry, state reading, and visual auditing directly from the command line.

## Architecture and Technical Concepts

This project implements a modern Web3 architecture by separating the interface logic from the blockchain logic:

* **Visual Engine (React + Ink):** Utilizes React to manage state and data lifecycles, rendering visual components directly in the standard terminal using the `ink` library.
* **Web3 Connectivity:** Implements auto-generated Soroban bindings and `stellar-sdk` to establish an RPC bridge with the Stellar Testnet.
* **Asynchronous Telemetry:** Uses React hooks (`useState`, `useEffect`) to perform asynchronous, read-only queries (`get_balance`) to the smart contract's persistent storage, incurring no gas costs for the user.
* **Strict Typing:** Built on TypeScript to ensure type safety in blockchain responses prior to rendering.
* **SPA Terminal Navigation:** Implements a state-based router allowing seamless navigation between SecOps modules (OSINT Scanner, Chaos Monkey) without tearing down the Node.js process.
## Prerequisites

To run this terminal in a local environment, you need:
* Node.js (v18 or higher recommended)
* npm (Node Package Manager)
* Internet access for the RPC connection to the Stellar Testnet

## Usage and Deployment Instructions

### 1. Installation
Clone the repository and install the Node dependencies:

```bash
git clone [https://github.com/alex0tico/kuyfi_tui.git](https://github.com/alex0tico/kuyfi_tui.git)
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
Once the client is compiled, you can launch the dashboard in your terminal by running the following command from the project root (`kuyfi_tui`):

```bash
npm run dev
# (In another terminal tab, run the interface with:)
npm start```

To exit the terminal and return to your standard command line, press `Ctrl + C`.

## Environment Customization (Local Auditing)

If you deploy a new version of the `kuyfi_core` contract and obtain a new Contract ID, you must update the data bridge:

1. Run the Stellar bindings command pointing to your new ID.
2. In the `source/app.tsx` file, update the `contractId` variable with your new address.
3. In the `client.get_balance()` function, update the `user` parameter with the public key of the wallet you wish to audit.