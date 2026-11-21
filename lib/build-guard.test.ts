import { describe, expect, it } from "vitest";

import { assertContractIdForBuild } from "./build-guard";

const ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

describe("assertContractIdForBuild", () => {
  it("fails the build when the id is missing and mock mode is off", () => {
    expect(() => assertContractIdForBuild({})).toThrow(/NEXT_PUBLIC_CONTRACT_ID is not set/);
    expect(() => assertContractIdForBuild({ NEXT_PUBLIC_CONTRACT_ID: "  " })).toThrow(
      /NEXT_PUBLIC_CONTRACT_ID is not set/,
    );
    expect(() => assertContractIdForBuild({ NEXT_PUBLIC_MOCK_API: "false" })).toThrow();
  });

  it("fails the build when GitHub Actions has no contract id", () => {
    expect(() =>
      assertContractIdForBuild({
        GITHUB_ACTIONS: "true",
        NEXT_PUBLIC_MOCK_API: "false",
      }),
    ).toThrow(/NEXT_PUBLIC_CONTRACT_ID is not set/);
  });

  it("passes when the id is set", () => {
    expect(() => assertContractIdForBuild({ NEXT_PUBLIC_CONTRACT_ID: ID })).not.toThrow();
  });

  it("passes in mock mode without an id", () => {
    expect(() => assertContractIdForBuild({ NEXT_PUBLIC_MOCK_API: "true" })).not.toThrow();
  });
});
