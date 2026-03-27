import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
// @ts-ignore
import * as KuyfiClient from '../src/kuyfi_client/dist/index.js';

export default function App() {
    const [status, setStatus] = useState('INITIALIZING WEB3 CONNECTION...');
    const [poolBalance, setPoolBalance] = useState<string | null>(null);
    const [contractId] = useState('CD7SXYR4QICJSKUVGA36JJVEEYJ3VR66CP6ULM5ZBIARA5X267GSKQF7');

    useEffect(() => {
        async function fetchOnChainData() {
            try {
                setStatus('CONSULTING SOROBAN NODE...');
                
                const ClientConstructor = (KuyfiClient as any).Client;
                const networks = (KuyfiClient as any).networks;

                if (!ClientConstructor || !networks) {
                    throw new Error('Bindings not properly loaded');
                }

                const client = new ClientConstructor({
                    ...networks.testnet,
                    contractId: contractId,
                });

                const balance = await client.get_balance({ 
                    user: "GCJOJHH3X5BLRL523UWMIUTW5TJFNY52F2NA6ZYWZHZGSB7OXHSGRDOQ" 
                });
                
                setPoolBalance(`${balance.result} XLM`);
                setStatus('SHIELD ONLINE (DATA SYNCED)');

            } catch (error) {
                setStatus('ERROR: RPC CONNECTION FAILED');
            }
        }

        fetchOnChainData();
    }, [contractId]);

    // --- SECCIÓN DE ARTE ASCII (Definida fuera del render para limpieza) ---
    
    const kuyfiLogo = `
 +   __ __  __  __  __  __  ____  ____
+   / // / / / / /  \\ \\/ / / __/ /  _/
+  / ,<   / /_/ /    \\  / / _/  _/ /  
+ /_/|_|  \\____/     /_/ /_/   /___/  
`;

    const cyberCat = `
      /\\_/\\
     ( o.o )
      > ^ <
     /     \\
    (|     |)
     \\_____/
`;

    // --- RENDERIZADO DE LA INTERFAZ ---
    return (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor="magenta">
            
            {/* Cabecera con Arte ASCII */}
            <Box flexDirection="row" justifyContent="center" marginBottom={1}>
                <Box marginRight={4}>
                    <Text color="magentaBright">{cyberCat}</Text>
                </Box>
                <Box flexDirection="column">
                    <Text color="magentaBright" bold>{kuyfiLogo}</Text>
                    <Text color="gray" dimColor> [ SECURITY TERMINAL v0.1 ]</Text>
                </Box>
            </Box>

            {/* Panel de Datos Técnicos */}
            <Box flexDirection="column" marginBottom={1} borderStyle="single" borderColor="gray" paddingLeft={1}>
                <Text color="cyan">➤ NETWORK:  <Text color="white">TESTNET</Text></Text>
                <Text color="cyan">➤ CONTRACT: <Text color="yellow">{contractId}</Text></Text>
                <Text color="cyan">➤ STATUS:   <Text color={status.includes('ERROR') ? 'red' : 'magentaBright'}>{status}</Text></Text>
                <Box marginTop={1}>
                    <Text color="cyan" bold>➤ POOL BALANCE: </Text>
                    <Text color="white" bold backgroundColor="magenta"> {poolBalance || "Syncing..."} </Text>
                </Box>
            </Box>

            {/* Tronco de Logs */}
            <Box flexDirection="column">
                <Text color="gray">System logs:</Text>
                <Text color="magenta">✔ Core engine loaded</Text>
                <Text color="magenta">✔ Soroban bridge established</Text>
                <Text color={poolBalance ? "greenBright" : "cyan"}>
                    {poolBalance ? "✔ Real-time telemetry synced" : "⏳ Fetching persistent storage..."}
                </Text>
            </Box>
        </Box>
    );
}