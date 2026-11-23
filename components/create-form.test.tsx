/* @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/native-asset", () => ({
  nativeAssetContractId: vi.fn(() =>
    "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  ),
}));

vi.mock("@/hooks/use-create-stream-form", () => ({
  useCreateStreamForm: vi.fn(),
}));

import {
  useCreateStreamForm,
  type CreateFormRefs,
  type CreateStreamForm,
} from "@/hooks/use-create-stream-form";
import { ACCOUNT_NOT_FOUND_MESSAGE } from "@/lib/contract-messages";
import { axeViolations } from "@/test/axe";
import type { CreateStreamParams } from "@/types/contract";

import { CreateForm } from "./create-form";

const SENDER = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const RECIPIENT = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB4QH";
const TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

function makeRefs(): CreateFormRefs {
  return {
    recipient: { current: null },
    token: { current: null },
    amount: { current: null },
    start: { current: null },
    end: { current: null },
    cliff: { current: null },
    durationAmount: { current: null },
  };
}

function makeFormState(overrides: Partial<CreateStreamForm> = {}): CreateStreamForm {
  return {
    sender: SENDER,
    values: {
      recipient: "",
      token: "",
      amount: "",
      start: "",
      end: "",
      cliff: "",
      durationAmount: "",
      durationUnit: "days",
    },
    errors: {},
    refs: makeRefs(),
    setField: vi.fn(),
    applyPreset: vi.fn(),
    previewRate: null,
    previewDuration: null,
    addressesValid: true,
    mismatch: false,
    submitting: false,
    stage: null,
    timeoutHash: null,
    error: null,
    prepared: null,
    tokenDecimals: 7,
    decimalsNotice: null,
    feeEstimate: { status: "unavailable" },
    balanceCheck: { status: "unavailable" },
    rememberedToken: null,
    clearRememberedToken: vi.fn(),
    handleSubmit: vi.fn(async () => {}),
    handleConfirm: vi.fn(async () => {}),
    handleRecoverTimeout: vi.fn(async () => {}),
    backToEdit: vi.fn(),
    ...overrides,
  };
}

const samplePrepared: CreateStreamParams = {
  sender: SENDER,
  recipient: RECIPIENT,
  token: TOKEN,
  totalAmount: 1_000_000_000n,
  startTime: 1_800_000_000,
  endTime: 1_800_086_400,
  cliffTime: 1_800_000_000,
};

const mockedUseCreateStreamForm = vi.mocked(useCreateStreamForm);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CreateForm", () => {
  describe("wallet not connected", () => {
    it("shows the connect-wallet prompt and blocks form/review", async () => {
      const state = makeFormState({ sender: null });
      mockedUseCreateStreamForm.mockReturnValue(state);

      const { container } = render(<CreateForm />);

      expect(screen.getByText("Connect your wallet to create a stream.")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Review stream" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Confirm & create" })).toBeNull();
      expect(state.handleSubmit).not.toHaveBeenCalled();
      expect(state.handleConfirm).not.toHaveBeenCalled();
      expect(await axeViolations(container)).toEqual([]);
    });
  });

  describe("initial form and validation display", () => {
    it("renders the form fields and passes axe in initial state", async () => {
      mockedUseCreateStreamForm.mockReturnValue(makeFormState());

      const { container } = render(<CreateForm />);

      expect(screen.getByLabelText("Recipient address")).toBeTruthy();
      expect(screen.getByLabelText("Token contract id")).toBeTruthy();
      expect(screen.getByLabelText("Amount")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Review stream" }).hasAttribute("disabled")).toBe(false);
      expect(await axeViolations(container)).toEqual([]);
    });

    it("renders field errors with alert roles and aria-describedby, and clears them when fixed", async () => {
      const erroredState = makeFormState({
        errors: {
          recipient: "Enter a valid Stellar address.",
          token: "Enter a valid token contract ID.",
          amount: "Enter a positive amount.",
        },
      });
      mockedUseCreateStreamForm.mockReturnValue(erroredState);

      const { container, rerender } = render(<CreateForm />);

      const recipientInput = screen.getByLabelText("Recipient address");
      expect(recipientInput.getAttribute("aria-invalid")).toBe("true");
      expect(recipientInput.getAttribute("aria-describedby")).toBe("recipient-error");
      expect(screen.getByText("Enter a valid Stellar address.").getAttribute("role")).toBe("alert");

      const tokenInput = screen.getByLabelText("Token contract id");
      expect(tokenInput.getAttribute("aria-invalid")).toBe("true");
      expect(tokenInput.getAttribute("aria-describedby")).toBe("token-error");

      const amountInput = screen.getByLabelText("Amount");
      expect(amountInput.getAttribute("aria-invalid")).toBe("true");
      expect(amountInput.getAttribute("aria-describedby")).toBe("amount-error");

      expect(await axeViolations(container)).toEqual([]);

      mockedUseCreateStreamForm.mockReturnValue(makeFormState({ errors: {} }));
      rerender(<CreateForm />);

      expect(screen.queryByText("Enter a valid Stellar address.")).toBeNull();
      expect(screen.getByLabelText("Recipient address").getAttribute("aria-invalid")).toBe("false");
    });

    it("disables submit when addresses are invalid, network mismatches, or submitting", () => {
      mockedUseCreateStreamForm.mockReturnValue(makeFormState({ addressesValid: false }));
      const { rerender } = render(<CreateForm />);
      expect(screen.getByRole("button", { name: "Review stream" }).hasAttribute("disabled")).toBe(true);

      mockedUseCreateStreamForm.mockReturnValue(makeFormState({ mismatch: true }));
      rerender(<CreateForm />);
      expect(screen.getByRole("button", { name: "Review stream" }).hasAttribute("disabled")).toBe(true);

      mockedUseCreateStreamForm.mockReturnValue(makeFormState({ submitting: true }));
      rerender(<CreateForm />);
      const pendingBtn = screen.getByRole("button", { name: "Creating..." });
      expect(pendingBtn.hasAttribute("disabled")).toBe(true);
    });

    it("calls handleSubmit once when the form is submitted", () => {
      const handleSubmit = vi.fn(async () => {});
      mockedUseCreateStreamForm.mockReturnValue(makeFormState({ handleSubmit }));

      render(<CreateForm />);
      fireEvent.submit(screen.getByRole("button", { name: "Review stream" }).closest("form")!);

      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });
  });

  describe("review step", () => {
    it("renders review details, derived rate/duration, loading/ready/shortfall states, and passes axe", async () => {
      mockedUseCreateStreamForm.mockReturnValue(
        makeFormState({
          prepared: samplePrepared,
          feeEstimate: { status: "loading" },
          balanceCheck: { status: "loading" },
        }),
      );

      const { container, rerender } = render(<CreateForm />);

      expect(screen.getByRole("heading", { name: "Review stream" })).toBeTruthy();
      expect(screen.getByText("Estimating…")).toBeTruthy();
      expect(screen.getByText("Checking…")).toBeTruthy();
      expect(screen.getByText("1 day")).toBeTruthy();
      expect(await axeViolations(container)).toEqual([]);

      mockedUseCreateStreamForm.mockReturnValue(
        makeFormState({
          prepared: samplePrepared,
          feeEstimate: { status: "ready", stroops: 12000n },
          balanceCheck: { status: "ready", balance: 500_000_000n, shortfall: 500_000_000n },
        }),
      );
      rerender(<CreateForm />);

      expect(screen.getByText(/~0\.0012 XLM/)).toBeTruthy();
      const alerts = screen.getAllByRole("alert");
      expect(alerts.some((el) => /short by/i.test(el.textContent ?? ""))).toBe(true);
    });

    it("calls backToEdit and handleConfirm, and disables buttons while submitting", () => {
      const backToEdit = vi.fn();
      const handleConfirm = vi.fn(async () => {});
      mockedUseCreateStreamForm.mockReturnValue(
        makeFormState({
          prepared: samplePrepared,
          backToEdit,
          handleConfirm,
        }),
      );

      const { rerender } = render(<CreateForm />);

      fireEvent.click(screen.getByRole("button", { name: "Back to edit" }));
      expect(backToEdit).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole("button", { name: "Confirm & create" }));
      expect(handleConfirm).toHaveBeenCalledTimes(1);

      mockedUseCreateStreamForm.mockReturnValue(
        makeFormState({
          prepared: samplePrepared,
          submitting: true,
          stage: "submitting",
        }),
      );
      rerender(<CreateForm />);

      expect(screen.getByRole("button", { name: "Back to edit" }).hasAttribute("disabled")).toBe(true);
      const confirmBtn = screen.getByRole("button", { name: "Creating…" });
      expect(confirmBtn.hasAttribute("disabled")).toBe(true);
      expect(confirmBtn.getAttribute("aria-busy")).toBe("true");
      expect(screen.getByRole("status", { name: "Transaction progress" })).toBeTruthy();
    });
  });

  describe("error and recovery alerts", () => {
    it("renders a generic error alert", () => {
      mockedUseCreateStreamForm.mockReturnValue(
        makeFormState({ error: "Signing was rejected in the wallet." }),
      );

      render(<CreateForm />);
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toBe("Signing was rejected in the wallet.");
    });

    it("renders AccountNotFoundAlert when error matches ACCOUNT_NOT_FOUND_MESSAGE", () => {
      mockedUseCreateStreamForm.mockReturnValue(
        makeFormState({ error: ACCOUNT_NOT_FOUND_MESSAGE }),
      );

      render(<CreateForm />);
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("Account not funded");
      expect(alert.textContent).toContain(ACCOUNT_NOT_FOUND_MESSAGE);
    });

    it("renders TimeoutRecoveryAlert and triggers handleRecoverTimeout on click", () => {
      const handleRecoverTimeout = vi.fn(async () => {});
      mockedUseCreateStreamForm.mockReturnValue(
        makeFormState({
          timeoutHash: "abc123deadbeef",
          handleRecoverTimeout,
        }),
      );

      render(<CreateForm />);
      expect(screen.getByText("Transaction confirmation timed out")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Re-check status" }));
      expect(handleRecoverTimeout).toHaveBeenCalledTimes(1);
    });
  });
});
