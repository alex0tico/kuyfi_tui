import React, { useState, useEffect, useCallback } from 'react';
import { Text, Box, useInput } from 'ink';
import type { TextProps } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { rpc as SorobanRpc, xdr } from '@stellar/stellar-sdk';
// @ts-ignore
import * as KuyfiClient from '../src/kuyfi_client/dist/index.js';

// Interfaz para ScannerView props
interface ScannerViewProps {
	contractId: string;
	setContractId: React.Dispatch<React.SetStateAction<string>>;
}

interface ContractFunction {
	name: string;
	inputs: string;
	outputs: string;
}

type ViewId = 'menu' | 'pool' | 'logs' | 'about' | 'scanner';

const menuItems = [
	{ label: '[1] Scanner OSINT', value: 'scanner' as const },
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

// ScannerView permite editar el contractId con validación en tiempo real
function ScannerView({ contractId, setContractId }: ScannerViewProps) {
	const [inputValue, setInputValue] = useState('');
	const [inputError, setInputError] = useState<string>('');
	const [isScanning, setIsScanning] = useState<boolean>(false);
	const [bytecodeSize, setBytecodeSize] = useState<number | null>(null);
	const [rpcError, setRpcError] = useState<string | null>(null);
	const [functions, setFunctions] = useState<ContractFunction[]>([]);

	// Valida y procesa el input cuando se presiona Enter
	function onSubmit(newValue: string) {
		const contractIdRegex = /^C[A-Z0-9]{55}$/;
		if (!contractIdRegex.test(newValue)) {
			setInputError('El Contract ID debe comenzar con "C" y tener exactamente 56 caracteres (A-Z, 0-9)');
			return;
		}
		setInputError('');
		setContractId(newValue);
	}

	useEffect(() => {
		if (!contractId) {
			setIsScanning(false);
			setBytecodeSize(null);
			setRpcError(null);
			setFunctions([]);
			return;
		}

		let cancelled = false;
		const fetchContractBytecode = async () => {
			setIsScanning(true);
			setBytecodeSize(null);
			setRpcError(null);
			setFunctions([]);

			try {
				const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
				const wasmBytecode = await server.getContractWasmByContractId(contractId);

				if (!wasmBytecode || wasmBytecode.length === 0) {
					throw new Error('CONTRACT_NOT_FOUND');
				}

				const sizeInBytes = wasmBytecode.length;
				const wasmModule = await WebAssembly.compile(Uint8Array.from(wasmBytecode));
				const [specSection] = WebAssembly.Module.customSections(wasmModule, 'contractspecv0');

				if (!specSection) {
					throw new Error('XDR_ALIGN_FAILURE');
				}

				const buffer = Buffer.from(specSection);
				let offset = 0;
				const entries = [];
				while (offset < buffer.length) {
					let success = false;
					// En XDR, cada bloque es obligatoriamente múltiplo de 4 bytes
					for (let len = 4; len <= buffer.length - offset; len += 4) {
						try {
							const chunk = buffer.slice(offset, offset + len);
							const entry = xdr.ScSpecEntry.fromXDR(chunk);
							entries.push(entry);
							offset += len; // Avanza el cursor exactamente lo que midió el objeto
							success = true;
							break;
						} catch {
							// Falla silenciosamente si el tamaño es incorrecto, intenta sumando 4 bytes más
						}
					}
					if (!success) {
						throw new Error('XDR_ALIGN_FAILURE');
					}
				}

				// Filtrar solo las funciones y mapearlas para la UI
				const parsedFunctions: ContractFunction[] = entries
					.filter((e: any) => e.switch().name === 'scSpecEntryFunctionV0')
					.map((e: any) => {
						const func = e.functionV0();
						return {
							name: func.name().toString('utf-8'),
							inputs: func.inputs().map((i: any) => i.name().toString('utf-8')).join(', '),
							outputs: func.outputs().length > 0 ? 'Has Return' : 'Void',
						};
					});

				if (!cancelled) {
					setBytecodeSize(sizeInBytes);
					setFunctions(parsedFunctions);
				}
			} catch (error: any) {
				if (!cancelled) {
					const rawMessage = String(error?.message || '').toLowerCase();
					if (rawMessage.includes('fetch') || rawMessage.includes('network')) {
						setRpcError('ERROR CRÍTICO: Sin conexión a la Testnet o RPC caído.');
					} else if (
						error?.message === 'CONTRACT_NOT_FOUND' ||
						rawMessage.includes('404') ||
						rawMessage.includes('not found') ||
						rawMessage.includes('null')
					) {
						setRpcError(
							'CONTRATO NO ENCONTRADO: Verifica que el Contract ID sea correcto y exista en la Testnet.',
						);
					} else if (error?.message === 'XDR_ALIGN_FAILURE') {
						setRpcError(
							'ERROR DE DECODIFICACIÓN: El WASM fue descargado, pero no contiene una sección contractspecv0 válida.',
						);
					} else {
						setRpcError(error?.message || 'Error consultando Soroban RPC.');
					}
					setIsScanning(false);
				}
			} finally {
				if (!cancelled) {
					setIsScanning(false);
				}
			}
		};

		fetchContractBytecode();
		return () => {
			cancelled = true;
		};
	}, [contractId]);

	return (
		<Box flexDirection="column">
			<Text color="cyan">[ScannerView]</Text>
			{(!contractId || Boolean(rpcError)) && (
				<>
					<Text>Introduce el Contract ID (empieza con 'C', 56 caracteres):</Text>
					<Text color="cyan">Ingrese Contract ID: </Text>
					<TextInput
						value={inputValue}
						onChange={setInputValue}
						onSubmit={onSubmit}
						placeholder="C..."
					/>
					{inputError && (
						<Text color="red" bold>
							{inputError}
						</Text>
					)}
				</>
			)}
			{isScanning && (
				<Box>
					<Text color="yellow">
						<Spinner type="dots" /> Extrayendo bytecode desde Testnet...
					</Text>
				</Box>
			)}
			{rpcError && (
				<Text color="red" bold>
					{rpcError}
				</Text>
			)}
			{bytecodeSize !== null && (
				<Text color="green">
					Reconocimiento exitoso. Tamaño del contrato: {bytecodeSize} bytes
				</Text>
			)}
			{!isScanning && functions.length > 0 && (
				<Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
					<Text color="cyan" bold>
						🛡️ SUPERFICIE DE ATAQUE (Contract Spec)
					</Text>
					{functions.map(fn => (
						<Box key={`${fn.name}:${fn.inputs}:${fn.outputs}`} flexDirection="row">
							<Text color="magentaBright" bold>
								{fn.name}
							</Text>
							<Text color="gray">({fn.inputs})</Text>
							<Text color="greenBright"> -&gt; {fn.outputs}</Text>
						</Box>
					))}
				</Box>
			)}
		</Box>
	);
}

const App: React.FC = () => {
	const [view, setView] = useState<ViewId>('menu');
	const [status, setStatus] = useState('INITIALIZING WEB3 CONNECTION...');
	const [poolBalance, setPoolBalance] = useState<string | null>(null);
	const [lastError, setLastError] = useState<string | null>(null);
	const [contractId, setContractId] = useState<string>('');

	useEffect(() => {
		if (view !== 'pool' || !contractId) {
			return undefined;
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
				<Box
					flexDirection="row"
					justifyContent="center"
					alignItems="center"
					marginBottom={1}
				>
					<Box marginRight={4}>
						<AsciiArt text={cyberCat} color="magentaBright" bold={false} />
					</Box>
					<Box flexDirection="column" alignItems="center">
						<AsciiArt text={kuyfiLogo} color="magentaBright" bold />
						<Text color="gray" dimColor>
							{' '}
							[ SECURITY TERMINAL v0.1 ]
						</Text>
					</Box>
					<Box marginLeft={4}>
						<AsciiArt text={cyberCat} color="magentaBright" bold={false} />
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
				<Box
					flexDirection="row"
					justifyContent="center"
					alignItems="center"
					marginBottom={1}
				>
					<Box marginRight={4}>
						<AsciiArt text={cyberCat} color="magentaBright" bold={false} />
					</Box>
					<Box flexDirection="column" alignItems="center">
						<AsciiArt text={kuyfiLogo} color="magentaBright" bold />
						<Text color="gray" dimColor>
							{' '}
							Vista: Pool / red
						</Text>
					</Box>
					<Box marginLeft={4}>
						<AsciiArt text={cyberCat} color="magentaBright" bold={false} />
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
	
	// Añade el renderizado de ScannerView y pasa las props necesarias
	if (view === 'scanner') {
		return (
			<ViewShell onBack={() => setView('menu')}>
				<ScannerView contractId={contractId} setContractId={setContractId} />
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
};

export default App;
