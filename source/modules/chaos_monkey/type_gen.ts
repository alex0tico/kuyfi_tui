import {Address, Keypair, xdr} from '@stellar/stellar-sdk';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTypeDef = any;

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

export function baseline(t: AnyTypeDef): xdr.ScVal {
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
			return xdr.ScVal.scvVec([]);
		case 'scSpecTypeMap':
			return xdr.ScVal.scvMap([]);
		case 'scSpecTypeOption':
			return xdr.ScVal.scvVoid();
		case 'scSpecTypeVoid':
			return xdr.ScVal.scvVoid();
		// UDT, Result, Tuple — skip; struct layout not derivable from spec entry alone
		default:
			return xdr.ScVal.scvVoid();
	}
}

export interface AttackVector {
	name: string;
	val: xdr.ScVal;
}

export function attackVals(t: AnyTypeDef): AttackVector[] {
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
			const elemBaseline = baseline(t.vec().elementType());
			return [
				{name: 'EMPTY_VEC', val: xdr.ScVal.scvVec([])},
				{
					name: 'LARGE_VEC',
					val: xdr.ScVal.scvVec(Array.from({length: 64}, () => elemBaseline)),
				},
			];
		}

		case 'scSpecTypeOption':
			return [
				{name: 'NONE', val: xdr.ScVal.scvVoid()},
				{name: 'SOME_BASELINE', val: baseline(t.option().valueType())},
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
		// UDT, Result, Map, Tuple — struct layout unknown from spec entry alone
		default:
			return [];
	}
}
