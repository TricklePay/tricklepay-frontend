/* @vitest-environment jsdom */

import { act, type FormEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/wallet-provider", () => ({
  useWallet: vi.fn(),
}));

vi.mock("@/hooks/use-network-guard", () => ({
  useNetworkGuard: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

import { useWallet } from "@/components/wallet-provider";
import { useNetworkGuard } from "@/hooks/use-network-guard";
import { useRouter } from "next/navigation";

import { useCreateStreamForm, type CreateStreamForm } from "./use-create-stream-form";

const SENDER = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const RECIPIENT = "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
const TOKEN = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

function fakeSubmitEvent(): FormEvent {
  return { preventDefault: () => {} } as unknown as FormEvent;
}

describe("useCreateStreamForm", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest!: CreateStreamForm;

  function Probe() {
    latest = useCreateStreamForm();
    return null;
  }

  async function renderForm() {
    await act(async () => {
      root.render(<Probe />);
    });
  }

  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(useWallet).mockReturnValue({
      address: SENDER,
      network: "testnet",
      connecting: false,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });
    vi.mocked(useNetworkGuard).mockReturnValue({
      mismatch: false,
      walletNetwork: "testnet",
      expectedNetwork: "testnet",
    });
    vi.mocked(useRouter).mockReturnValue({ push: vi.fn() } as unknown as ReturnType<
      typeof useRouter
    >);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("reports validation errors for bad input", async () => {
    await renderForm();

    // Empty form: every required field must be flagged and no review step shown.
    await act(async () => {
      await latest.handleSubmit(fakeSubmitEvent());
    });

    expect(latest.errors.recipient).toBe("Recipient address is required.");
    expect(latest.errors.token).toBe("Token contract id is required.");
    expect(latest.errors.amount).toBe("Amount is required.");
    expect(latest.errors.start).toBe("Start date is required.");
    expect(latest.errors.end).toBe("End date is required.");
    expect(latest.prepared).toBeNull();
  });

  it("reports a clean state for valid input", async () => {
    await renderForm();

    await act(async () => {
      latest.setField("recipient", RECIPIENT);
    });
    await act(async () => {
      latest.setField("token", TOKEN);
    });
    await act(async () => {
      latest.setField("amount", "12.5");
    });
    await act(async () => {
      latest.setField("start", "2026-08-27T10:00");
    });
    await act(async () => {
      latest.setField("end", "2026-08-27T12:00");
    });

    await act(async () => {
      await latest.handleSubmit(fakeSubmitEvent());
    });

    expect(latest.errors.recipient).toBeUndefined();
    expect(latest.errors.token).toBeUndefined();
    expect(latest.errors.amount).toBeUndefined();
    expect(latest.errors.start).toBeUndefined();
    expect(latest.errors.end).toBeUndefined();
    expect(latest.errors.cliff).toBeUndefined();
    // Validation passed: the hook holds the exact params confirm will submit.
    expect(latest.prepared).not.toBeNull();
    expect(latest.prepared).toMatchObject({ sender: SENDER, recipient: RECIPIENT, token: TOKEN });
  });
});
