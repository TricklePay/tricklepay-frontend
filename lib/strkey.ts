// Lightweight, zero-dependency Stellar StrKey validation and contract-id
// encoding (SEP-0023). Keeping this separate from `@stellar/stellar-sdk` lets
// config, validation, native-asset, and token-metadata run without pulling the
// full SDK into the initial client bundle.

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const BASE32_LOOKUP = new Int8Array(128).fill(-1);
for (let i = 0; i < BASE32_ALPHABET.length; i++) {
  BASE32_LOOKUP[BASE32_ALPHABET.charCodeAt(i)] = i;
}

const VERSION_BYTE_ED25519_PUBLIC_KEY = 6 << 3; // 48 -> 'G'
const VERSION_BYTE_CONTRACT = 2 << 3; // 16 -> 'C'
const STRKEY_LENGTH = 56; // 35 bytes * 8 / 5 = 56 base32 chars (no padding)
const DECODED_LENGTH = 35; // 1 version byte + 32 payload bytes + 2 CRC16 bytes

function crc16Xmodem(data: Uint8Array, length: number): number {
  let crc = 0x0000;
  for (let i = 0; i < length; i++) {
    crc ^= data[i] << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc;
}

function decodeBase32Fixed35(input: string): Uint8Array | null {
  if (input.length !== STRKEY_LENGTH) return null;

  const out = new Uint8Array(DECODED_LENGTH);
  let bits = 0;
  let value = 0;
  let outIndex = 0;

  for (let i = 0; i < STRKEY_LENGTH; i++) {
    const code = input.charCodeAt(i);
    if (code >= 128) return null;
    const digit = BASE32_LOOKUP[code];
    if (digit === -1) return null;

    value = (value << 5) | digit;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      out[outIndex++] = (value >>> bits) & 0xff;
    }
  }

  return out;
}

function encodeBase32(bytes: Uint8Array): string {
  let result = "";
  let bits = 0;
  let value = 0;

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }

  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return result;
}

function isValidStrKey(value: unknown, expectedVersionByte: number): boolean {
  if (typeof value !== "string") return false;
  const decoded = decodeBase32Fixed35(value);
  if (!decoded) return false;

  if (decoded[0] !== expectedVersionByte) return false;

  const expectedCrc = crc16Xmodem(decoded, DECODED_LENGTH - 2);
  const actualCrc = decoded[DECODED_LENGTH - 2] | (decoded[DECODED_LENGTH - 1] << 8);
  return expectedCrc === actualCrc;
}

/**
 * Returns true if `value` is a valid Stellar Ed25519 public key (`G...`).
 */
export function isValidEd25519PublicKey(value: string): boolean {
  return isValidStrKey(value, VERSION_BYTE_ED25519_PUBLIC_KEY);
}

/**
 * Returns true if `value` is a valid Soroban contract address (`C...`).
 */
export function isValidContract(value: string): boolean {
  return isValidStrKey(value, VERSION_BYTE_CONTRACT);
}

/**
 * Encodes a 32-byte Soroban contract hash as a `C...` StrKey address.
 */
export function encodeContract(rawContractId: Uint8Array): string {
  if (rawContractId.length !== 32) {
    throw new Error(`Expected 32-byte contract hash, got ${rawContractId.length} bytes.`);
  }

  const payload = new Uint8Array(DECODED_LENGTH);
  payload[0] = VERSION_BYTE_CONTRACT;
  payload.set(rawContractId, 1);

  const crc = crc16Xmodem(payload, DECODED_LENGTH - 2);
  payload[DECODED_LENGTH - 2] = crc & 0xff;
  payload[DECODED_LENGTH - 1] = (crc >>> 8) & 0xff;

  return encodeBase32(payload);
}
