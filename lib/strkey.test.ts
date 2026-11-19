import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { encodeContract, isValidContract, isValidEd25519PublicKey } from "@/lib/strkey";

const VALID_PUBLIC_KEY = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const VALID_CONTRACT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";
const TESTNET_XLM_CONTRACT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

describe("lib/strkey", () => {
  describe("isValidEd25519PublicKey", () => {
    it("accepts valid G... public keys matching StrKey", () => {
      const randomKey = Keypair.random().publicKey();
      expect(isValidEd25519PublicKey(VALID_PUBLIC_KEY)).toBe(true);
      expect(isValidEd25519PublicKey(randomKey)).toBe(true);
      expect(isValidEd25519PublicKey(randomKey)).toBe(StrKey.isValidEd25519PublicKey(randomKey));
    });

    it("rejects contract addresses, lowercase, bad checksums, and malformed strings", () => {
      const badChecksum = VALID_PUBLIC_KEY.slice(0, -1) + (VALID_PUBLIC_KEY.endsWith("A") ? "B" : "A");
      const cases = [
        "",
        VALID_CONTRACT,
        VALID_PUBLIC_KEY.toLowerCase(),
        badChecksum,
        VALID_PUBLIC_KEY.slice(0, -1),
        `${VALID_PUBLIC_KEY}A`,
        "not-an-address",
      ];
      for (const value of cases) {
        expect(isValidEd25519PublicKey(value)).toBe(false);
        expect(isValidEd25519PublicKey(value)).toBe(StrKey.isValidEd25519PublicKey(value));
      }
    });
  });

  describe("isValidContract", () => {
    it("accepts valid C... contract addresses matching StrKey", () => {
      expect(isValidContract(VALID_CONTRACT)).toBe(true);
      expect(isValidContract(TESTNET_XLM_CONTRACT)).toBe(true);
      expect(isValidContract(TESTNET_XLM_CONTRACT)).toBe(
        StrKey.isValidContract(TESTNET_XLM_CONTRACT),
      );
    });

    it("rejects G... keys, lowercase, bad checksums, and malformed strings", () => {
      const badChecksum = VALID_CONTRACT.slice(0, -1) + (VALID_CONTRACT.endsWith("A") ? "B" : "A");
      const cases = [
        "",
        VALID_PUBLIC_KEY,
        VALID_CONTRACT.toLowerCase(),
        badChecksum,
        VALID_CONTRACT.slice(0, -1),
        `${VALID_CONTRACT}A`,
        "C12345",
      ];
      for (const value of cases) {
        expect(isValidContract(value)).toBe(false);
        expect(isValidContract(value)).toBe(StrKey.isValidContract(value));
      }
    });
  });

  describe("encodeContract", () => {
    it("matches StrKey.encodeContract for 32-byte contract hashes", () => {
      const zeroHash = new Uint8Array(32);
      expect(encodeContract(zeroHash)).toBe(StrKey.encodeContract(Buffer.from(zeroHash)));

      const sampleHash = Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + 13) & 0xff);
      expect(encodeContract(sampleHash)).toBe(StrKey.encodeContract(Buffer.from(sampleHash)));
    });
  });
});
