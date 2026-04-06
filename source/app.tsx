import React, { useState, useEffect, useCallback } from 'react';
import { Text, Box, useInput } from 'ink';
import type { TextProps } from 'ink';
import SelectInput from 'ink-select-input';
// @ts-ignore
import * as KuyfiClient from '../src/kuyfi_client/dist/index.js';

type ViewId = 'menu' | 'pool' | 'logs' | 'about';

const menuItems = [
	{ label: 'Pool / red (datos en vivo)', value: 'pool' as const },
	{ label: 'Registros del sistema', value: 'logs' as const },
	{ label: 'Acerca de', value: 'about' as const },
];

function AsciiArt({
	text,
	color,
	bold = false,
}: {
	text: string;
	color: string;
	bold?: boolean;
}) {
	const lines = text.split('\n');
	return (
		<Box flexDirection="column">
			{lines.map((line, index) => (
				<Text
					key={index}
					color={color as TextProps['color']}
					bold={bold}
				>
					{line}
				</Text>
			))}
		</Box>
	);
}

function ViewShell({
	children,
	onBack,
}: {
	children: React.ReactNode;
	onBack: () => void;
}) {
	useInput(
		useCallback((_input, key) => {
			if (key.escape) {
				onBack();
			}
		}, [onBack]),
	);

	return (
		<Box flexDirection="column" padding={1} borderStyle="round" borderColor="magenta">
			<Text color="gray" dimColor>
				[Esc] Volver al menú
			</Text>
			{children}
		</Box>
	);
}

export default function App() {
	const [view, setView] = useState<ViewId>('menu');
	const [status, setStatus] = useState('INITIALIZING WEB3 CONNECTION...');
	const [poolBalance, setPoolBalance] = useState<string | null>(null);
	const [lastError, setLastError] = useState<string | null>(null);
	const [contractId] = useState(
		'CAV2DLUWVABTEFGWBGJXROWMKNEFT5JJMRISRBRF7K666BQ4J3LFMLHO',
	);

	useEffect(() => {
		if (view !== 'pool') {
			return;
		}

		async function fetchOnChainData() {
			try {
				const exportedKeys = Object.keys(KuyfiClient).join(', ');

				const ClientConstructor =
					(KuyfiClient as any).Client || (KuyfiClient as any).Contract;

				if (!ClientConstructor) {
					throw new Error(
						`Constructor no encontrado. Exportaciones reales: ${exportedKeys}`,
					);
				}

				const client = new ClientConstructor({
					networkPassphrase: 'Test SDF Network ; September 2015',
					rpcUrl: 'https://soroban-testnet.stellar.org',
					contractId,
				});

				if (
					typeof client.get_balance !== 'function' &&
					typeof client.getBalance !== 'function'
				) {
					const classMethods = Object.getOwnPropertyNames(
						Object.getPrototypeOf(client),
					).join(', ');
					const directProps = Object.keys(client).join(', ');
					throw new Error(
						`MÉTODOS ENCONTRADOS -> Prototipo: [${classMethods}] | Directos: [${directProps}]`,
					);
				}

				const balanceFunc = client.get_balance || client.getBalance;
				const balance = await balanceFunc.call(client, {
					user: 'GCJOJHH3X5BLRL523UWMIUTW5TJFNY52F2NA6ZYWZHZGSB7OXHSGRDOQ',
				});

				setLastError(null);
				const finalBalance =
					balance.result !== undefined ? balance.result : balance;
				setPoolBalance(`${finalBalance} XLM`);
				setStatus('SHIELD ONLINE (SYNCING LIVE...)');
			} catch (error: any) {
				setStatus('ERROR: DIAGNOSTIC FAILED');
				setLastError(error.message || String(error));
			}
		}

		fetchOnChainData();
		const interval = setInterval(fetchOnChainData, 5000);
		return () => clearInterval(interval);
	}, [contractId, view]);

	const kuyfiLogo = `
   __ __  __  __  __  __  ____  ____
  / // / / / / /  \\ \\/ / / __/ /  _/
 / ,<   / /_/ /    \\  / / _/  _/ /  
/_/|_|  \\____/     /_/ /_/   /___/  
`;

	const cyberCat = `
      /\\_/\\
     ( o.o )
      > ^ <
     /     \\
    (|     |)
     \\_____/
`;

	if (view === 'menu') {
		return (
			<Box flexDirection="column" padding={1} borderStyle="round" borderColor="magenta">
				<Box flexDirection="row" justifyContent="center" marginBottom={1}>
					<Box marginRight={4}>
						<AsciiArt text={cyberCat} color="magentaBright" bold={false} />
					</Box>
					<Box flexDirection="column">
						<AsciiArt text={kuyfiLogo} color="magentaBright" bold />
						<Text color="gray" dimColor>
							{' '}
							[ SECURITY TERMINAL v0.1 ]
						</Text>
					</Box>
				</Box>
                <Box marginBottom={1}>
				    <Text bold color="cyan">
                        Menú principal — flechas / Enter
                    </Text>
                </Box>
				<SelectInput
					items={menuItems}
					onSelect={item => {
						setView(item.value);
					}}
				/>
			</Box>
		);
	}

	if (view === 'pool') {
		return (
			<ViewShell onBack={() => setView('menu')}>
				<Box flexDirection="row" justifyContent="center" marginBottom={1}>
					<Box marginRight={4}>
						<AsciiArt text={cyberCat} color="magentaBright" bold={false} />
					</Box>
					<Box flexDirection="column">
						<AsciiArt text={kuyfiLogo} color="magentaBright" bold />
						<Text color="gray" dimColor>
							{' '}
							Vista: Pool / red
						</Text>
					</Box>
				</Box>

				<Box
					flexDirection="column"
					marginBottom={1}
					borderStyle="single"
					borderColor="gray"
					paddingLeft={1}
				>
					<Text color="cyan">
						➤ NETWORK: <Text color="white">TESTNET</Text>
					</Text>
					<Text color="cyan">
						➤ CONTRACT: <Text color="yellow">{contractId}</Text>
					</Text>
					<Text color="cyan">
						➤ STATUS:{' '}
						<Text color={status.includes('ERROR') ? 'red' : 'magentaBright'}>
							{status}
						</Text>
					</Text>
					<Box marginTop={1}>
						<Text color="cyan" bold>
							➤ POOL BALANCE:{' '}
						</Text>
						<Text color="white" bold backgroundColor="magenta">
							{' '}
							{poolBalance || 'Syncing...'}{' '}
						</Text>
					</Box>
				</Box>

				<Box flexDirection="column">
					<Text color="gray">System logs:</Text>
					<Text color="magenta">✔ Core engine loaded</Text>
					<Text color="magenta">✔ Soroban bridge established</Text>
					{lastError ? (
						<Text color="red">✖ DEBUG ERROR: {lastError}</Text>
					) : (
						<Text color={poolBalance ? 'greenBright' : 'cyan'}>
							{poolBalance
								? '✔ Real-time telemetry synced'
								: '⏳ Fetching persistent storage...'}
						</Text>
					)}
				</Box>
			</ViewShell>
		);
	}

	if (view === 'logs') {
		return (
			<ViewShell onBack={() => setView('menu')}>
				<Box marginBottom={1}>
					<Text bold color="cyan">
						Registros
					</Text>
                </Box>
				<Text color="magenta">✔ Core engine loaded</Text>
				<Text color="magenta">✔ Soroban bridge established</Text>
				{lastError ? (
					<Text color="red">✖ Último error: {lastError}</Text>
				) : (
					<Text color="greenBright">Sin errores registrados en esta sesión.</Text>
				)}
				<Box marginTop={1}>
					<Text dimColor>
						Abre «Pool / red» para telemetría en vivo y errores de RPC.
					</Text>
				</Box>
			</ViewShell>
		);
	}
	return (
		<ViewShell onBack={() => setView('menu')}>
			<Box marginBottom={1}>
                <Text bold color="cyan">
				    Acerca de
			    </Text>
            </Box>
			<Text>Kuyfi TUI — terminal de seguridad v0.1</Text>
			<Text dimColor>Stack: Ink + React + ink-select-input</Text>
			<Box marginTop={1} flexDirection="column">
				<Text color="gray">Atajos</Text>
				<Text>• En el menú: flechas, Enter, o teclas 1–3</Text>
				<Text>• En cualquier vista: Esc → menú</Text>
			</Box>
		</ViewShell>
	);
}
