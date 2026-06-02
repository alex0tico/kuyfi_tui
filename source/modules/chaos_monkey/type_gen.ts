import {Address, Keypair, xdr} from '@stellar/stellar-sdk';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTypeDef = any;

export interface UdtField {
	name: string;
	type: AnyTypeDef; // xdr.ScSpecTypeDef
}

/**
 * Registry of UDT struct definitions keyed by struct name.
 * Populated from scSpecEntryUdtStructV0 entries in the contract spec.
 * Used by baseline() and attackVals() to build valid struct ScVals.
 */
export type UdtRegistry = Map<string, UdtField[]>;

export function typeName(t: AnyTypeDef): string {
	const n: string = t.switch().name;
	switch (n) {
		case 'scSpecTypeOption':
			return `Option<${typeName(t.option().valueType())}>`;
		case 'scSpecTypeResult':
			return `Result<${typeName(t.result().okType())}, ${typeName(t.result().errorType())}>`;
		case 'scSpecTypeVec':
			return `Vec<${typeName(t.vec().elementType())}>`;
		case 'scSpecTypeMap':
			return `Map<${typeName(t.map().keyType())}, ${typeName(t.map().valueType())}>`;
		case 'scSpecTypeTuple':
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			return `(${(t.tuple().valueTypes() as AnyTypeDef[]).map(typeName).join(', ')})`;
		case 'scSpecTypeBytesN':
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			return `BytesN<${t.bytesN().n() as number}>`;
		case 'scSpecTypeUdt':
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			return (t.udt().name() as Buffer).toString('utf-8');
		default:
			return n.replace(/^scSpecType/, '');
	}
}

/**
 * Builds a baseline (safe, type-correct, all-zeros-ish) ScVal for a given type.
 * For UDT structs, constructs a ScVal::Map using the registry.
 * Recursive: handles Vec<UDT>, Option<UDT>, etc.
 */
export function baseline(t: AnyTypeDef, registry: UdtRegistry = new Map()): xdr.ScVal {
	const n: string = t.switch().name;
	switch (n) {
		case 'scSpecTypeU32':
			return xdr.ScVal.scvU32(0);
		case 'scSpecTypeI32':
			return xdr.ScVal.scvI32(0);
		case 'scSpecTypeU64':
			return xdr.ScVal.scvU64(xdr.Uint64.fromString('0'));
		case 'scSpecTypeI64':
			return xdr.ScVal.scvI64(xdr.Int64.fromString('0'));
		case 'scSpecTypeTimepoint':
			return xdr.ScVal.scvTimepoint(xdr.Uint64.fromString('0'));
		case 'scSpecTypeDuration':
			return xdr.ScVal.scvDuration(xdr.Uint64.fromString('0'));
		case 'scSpecTypeU128':
			return xdr.ScVal.scvU128(
				new xdr.UInt128Parts({
					hi: xdr.Uint64.fromString('0'),
					lo: xdr.Uint64.fromString('0'),
				}),
			);
		case 'scSpecTypeI128':
			return xdr.ScVal.scvI128(
				new xdr.Int128Parts({
					hi: xdr.Int64.fromString('0'),
					lo: xdr.Uint64.fromString('0'),
				}),
			);
		case 'scSpecTypeU256':
			return xdr.ScVal.scvU256(
				new xdr.UInt256Parts({
					hiHi: xdr.Uint64.fromString('0'),
					hiLo: xdr.Uint64.fromString('0'),
					loHi: xdr.Uint64.fromString('0'),
					loLo: xdr.Uint64.fromString('0'),
				}),
			);
		case 'scSpecTypeI256':
			return xdr.ScVal.scvI256(
				new xdr.Int256Parts({
					hiHi: xdr.Int64.fromString('0'),
					hiLo: xdr.Uint64.fromString('0'),
					loHi: xdr.Uint64.fromString('0'),
					loLo: xdr.Uint64.fromString('0'),
				}),
			);
		case 'scSpecTypeAddress':
			return new Address(Keypair.random().publicKey()).toScVal();
		case 'scSpecTypeBool':
			return xdr.ScVal.scvBool(false);
		case 'scSpecTypeSymbol':
			return xdr.ScVal.scvSymbol('');
		case 'scSpecTypeString':
			return xdr.ScVal.scvString(Buffer.from(''));
		case 'scSpecTypeBytes':
			return xdr.ScVal.scvBytes(Buffer.from(''));
		case 'scSpecTypeBytesN':
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			return xdr.ScVal.scvBytes(Buffer.alloc(t.bytesN().n() as number));
		case 'scSpecTypeVec':
			return xdr.ScVal.scvVec([baseline(t.vec().elementType(), registry)]);
		case 'scSpecTypeMap':
			return xdr.ScVal.scvMap([]);
		case 'scSpecTypeOption':
			return xdr.ScVal.scvVoid();
		case 'scSpecTypeVoid':
			return xdr.ScVal.scvVoid();
		case 'scSpecTypeUdt': {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const udtName = (t.udt().name() as Buffer).toString('utf-8');
			const fields = registry.get(udtName);
			if (fields) {
				return buildStructScVal(fields, registry);
			}

			// Unknown UDT (union, enum, or unregistered) — void is the safest fallback
			return xdr.ScVal.scvVoid();
		}

		// Result, Tuple — layout not derivable without full schema
		default:
			return xdr.ScVal.scvVoid();
	}
}

/**
 * Constructs a ScVal::Map representing a Soroban struct.
 * Entries are sorted lexicographically by field name, as Soroban requires.
 */
function buildStructScVal(fields: UdtField[], registry: UdtRegistry): xdr.ScVal {
	const sorted = [...fields].sort((a, b) => a.name.localeCompare(b.name));
	const entries = sorted.map(
		f =>
			new xdr.ScMapEntry({
				key: xdr.ScVal.scvSymbol(f.name),
				val: baseline(f.type, registry),
			}),
	);
	return xdr.ScVal.scvMap(entries);
}

export interface AttackVector {
	name: string;
	val: xdr.ScVal;
}

/**
 * Generates type-correct attack ScVals for a given parameter type.
 * For Vec<UDT>, uses real struct instances (via registry) instead of Void elements.
 * Vec vectors are kept small (empty + one-element) to avoid oversized transactions.
 */
export function attackVals(t: AnyTypeDef, registry: UdtRegistry = new Map()): AttackVector[] {
	const n: string = t.switch().name;
	switch (n) {
		case 'scSpecTypeU32':
			return [
				{name: 'ZERO', val: xdr.ScVal.scvU32(0)},
				{name: 'ONE', val: xdr.ScVal.scvU32(1)},
				{name: 'MAX_U32', val: xdr.ScVal.scvU32(4_294_967_295)},
			];
		case 'scSpecTypeI32':
			return [
				{name: 'ZERO', val: xdr.ScVal.scvI32(0)},
				{name: 'NEG_ONE', val: xdr.ScVal.scvI32(-1)},
				{name: 'MAX_I32', val: xdr.ScVal.scvI32(2_147_483_647)},
				{name: 'MIN_I32', val: xdr.ScVal.scvI32(-2_147_483_648)},
			];
		case 'scSpecTypeU64':
			return [
				{name: 'ZERO', val: xdr.ScVal.scvU64(xdr.Uint64.fromString('0'))},
				{name: 'ONE', val: xdr.ScVal.scvU64(xdr.Uint64.fromString('1'))},
				{name: 'MAX_U64', val: xdr.ScVal.scvU64(xdr.Uint64.fromString('18446744073709551615'))},
			];
		case 'scSpecTypeI64':
			return [
				{name: 'ZERO', val: xdr.ScVal.scvI64(xdr.Int64.fromString('0'))},
				{name: 'NEG_ONE', val: xdr.ScVal.scvI64(xdr.Int64.fromString('-1'))},
				{name: 'MAX_I64', val: xdr.ScVal.scvI64(xdr.Int64.fromString('9223372036854775807'))},
				{name: 'MIN_I64', val: xdr.ScVal.scvI64(xdr.Int64.fromString('-9223372036854775808'))},
			];
		case 'scSpecTypeU128':
			return [
				{
					name: 'ZERO',
					val: xdr.ScVal.scvU128(
						new xdr.UInt128Parts({hi: xdr.Uint64.fromString('0'), lo: xdr.Uint64.fromString('0')}),
					),
				},
				{
					name: 'ONE',
					val: xdr.ScVal.scvU128(
						new xdr.UInt128Parts({hi: xdr.Uint64.fromString('0'), lo: xdr.Uint64.fromString('1')}),
					),
				},
				{
					name: 'MAX_U128',
					val: xdr.ScVal.scvU128(
						new xdr.UInt128Parts({
							hi: xdr.Uint64.fromString('18446744073709551615'),
							lo: xdr.Uint64.fromString('18446744073709551615'),
						}),
					),
				},
			];
		case 'scSpecTypeI128':
			return [
				{
					name: 'ZERO',
					val: xdr.ScVal.scvI128(
						new xdr.Int128Parts({hi: xdr.Int64.fromString('0'), lo: xdr.Uint64.fromString('0')}),
					),
				},
				{
					name: 'ONE',
					val: xdr.ScVal.scvI128(
						new xdr.Int128Parts({hi: xdr.Int64.fromString('0'), lo: xdr.Uint64.fromString('1')}),
					),
				},
				{
					name: 'NEG_ONE',
					val: xdr.ScVal.scvI128(
						new xdr.Int128Parts({
							hi: xdr.Int64.fromString('-1'),
							lo: xdr.Uint64.fromString('18446744073709551615'),
						}),
					),
				},
				{
					name: 'MAX_I128',
					val: xdr.ScVal.scvI128(
						new xdr.Int128Parts({
							hi: xdr.Int64.fromString('9223372036854775807'),
							lo: xdr.Uint64.fromString('18446744073709551615'),
						}),
					),
				},
				{
					name: 'MIN_I128',
					val: xdr.ScVal.scvI128(
						new xdr.Int128Parts({
							hi: xdr.Int64.fromString('-9223372036854775808'),
							lo: xdr.Uint64.fromString('0'),
						}),
					),
				},
			];
		case 'scSpecTypeAddress':
			return [
				{name: 'RANDOM_ADDR_A', val: new Address(Keypair.random().publicKey()).toScVal()},
				{name: 'RANDOM_ADDR_B', val: new Address(Keypair.random().publicKey()).toScVal()},
			];
		case 'scSpecTypeBool':
			return [
				{name: 'TRUE', val: xdr.ScVal.scvBool(true)},
				{name: 'FALSE', val: xdr.ScVal.scvBool(false)},
			];
		case 'scSpecTypeSymbol':
			return [
				{name: 'EMPTY_SYMBOL', val: xdr.ScVal.scvSymbol('')},
				{name: 'LONG_SYMBOL', val: xdr.ScVal.scvSymbol('a'.repeat(32))},
				{name: 'OVERSIZE_SYMBOL', val: xdr.ScVal.scvSymbol('a'.repeat(64))},
			];
		case 'scSpecTypeString':
			return [
				{name: 'EMPTY_STR', val: xdr.ScVal.scvString(Buffer.from(''))},
				{name: 'LONG_STR', val: xdr.ScVal.scvString(Buffer.from('a'.repeat(256)))},
			];
		case 'scSpecTypeBytes':
			return [
				{name: 'EMPTY_BYTES', val: xdr.ScVal.scvBytes(Buffer.from(''))},
				{name: 'LARGE_BYTES', val: xdr.ScVal.scvBytes(Buffer.alloc(256))},
			];
		case 'scSpecTypeBytesN': {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const byteLen = t.bytesN().n() as number;
			return [
				{name: 'ZERO_BYTES_N', val: xdr.ScVal.scvBytes(Buffer.alloc(byteLen))},
				{name: 'FF_BYTES_N', val: xdr.ScVal.scvBytes(Buffer.alloc(byteLen, 0xff))},
			];
		}

		case 'scSpecTypeVec': {
			const elemType = t.vec().elementType();
			const elemBase = baseline(elemType, registry);
			return [
				{name: 'EMPTY_VEC', val: xdr.ScVal.scvVec([])},
				// ONE_ELEM uses a real struct instance (or primitive baseline) — no more Void elements
				{name: 'ONE_ELEM_VEC', val: xdr.ScVal.scvVec([elemBase])},
				{name: 'TWO_ELEM_VEC', val: xdr.ScVal.scvVec([elemBase, elemBase])},
			];
		}

		case 'scSpecTypeOption':
			return [
				{name: 'NONE', val: xdr.ScVal.scvVoid()},
				{name: 'SOME_BASELINE', val: baseline(t.option().valueType(), registry)},
			];
		case 'scSpecTypeTimepoint':
			return [
				{name: 'ZERO_TS', val: xdr.ScVal.scvTimepoint(xdr.Uint64.fromString('0'))},
				{name: 'MAX_TS', val: xdr.ScVal.scvTimepoint(xdr.Uint64.fromString('18446744073709551615'))},
			];
		case 'scSpecTypeDuration':
			return [
				{name: 'ZERO_DUR', val: xdr.ScVal.scvDuration(xdr.Uint64.fromString('0'))},
				{name: 'MAX_DUR', val: xdr.ScVal.scvDuration(xdr.Uint64.fromString('18446744073709551615'))},
			];
		// UDT direct, Result, Map, Tuple — skip; these are used as Vec elements via baseline(), not fuzzed directly
		default:
			return [];
	}
}
