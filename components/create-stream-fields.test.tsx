/* @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the helper so the assertion never calls Asset.native().contractId()
// inside the jsdom realm (jsdom's Uint8Array is a different constructor than
// Node's, which the Stellar SDK rejects). The helper itself is still tested
// for real in lib/native-asset.test.ts, which runs under Node.
vi.mock("@/lib/native-asset", () => ({
  nativeAssetContractId: vi.fn(() =>
    "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  ),
}));

import type { CreateFormRefs } from "@/hooks/use-create-stream-form";
import { nativeAssetContractId } from "@/lib/native-asset";

import { CreateStreamFields } from "./create-stream-fields";

describe("CreateStreamFields", () => {
  const defaultProps = {
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
    refs: {
      recipient: { current: null },
      token: { current: null },
      amount: { current: null },
      start: { current: null },
      end: { current: null },
      cliff: { current: null },
      durationAmount: { current: null },
    } as CreateFormRefs,
    onFieldChange: vi.fn(),
    onApplyPreset: vi.fn(),
    rememberedToken: null,
    onClearRememberedToken: vi.fn(),
    walletAddress: null,
    previewRate: null,
    previewDuration: null,
    feedback: null,
    submitting: false,
    submitDisabled: false,
    onSubmit: vi.fn(),
  };

  it("renders every expected field", () => {
    const element = CreateStreamFields(defaultProps);
    const renderedOutput = JSON.stringify(element);

    expect(renderedOutput).toContain("Recipient address");
    expect(renderedOutput).toContain("Token contract id");
    expect(renderedOutput).toContain("Amount");
    expect(renderedOutput).toContain("Start");
    expect(renderedOutput).toContain("End");
    // We expect the cliff field to be present
    expect(renderedOutput).toContain("Cliff");
  });

  // DurationField is a child component CreateStreamFields doesn't invoke
  // itself — calling CreateStreamFields as a plain function (as the tests
  // above do) leaves it as an unexpanded element, so its own rendered text
  // never reaches that JSON. A real render is needed to see it.
  describe("the duration shortcut", () => {
    it("is present, labelled, and disabled until a start time is entered", () => {
      render(<CreateStreamFields {...defaultProps} />);

      // getByText/getByPlaceholderText/getByLabelText already throw if the
      // element isn't in the document, so finding them is itself the
      // presence assertion — no jest-dom matcher needed.
      expect(screen.getByText("Duration (optional)")).toBeTruthy();
      expect(screen.getByText("Fill in Start to use this.")).toBeTruthy();
      expect(screen.getByPlaceholderText("30").hasAttribute("disabled")).toBe(true);
      expect(screen.getByLabelText("Duration unit").hasAttribute("disabled")).toBe(true);
    });

    it("is enabled once a start time is entered", () => {
      render(
        <CreateStreamFields
          {...defaultProps}
          values={{ ...defaultProps.values, start: "2026-08-27T10:00" }}
        />,
      );

      expect(screen.getByText(/Sets End from Start/)).toBeTruthy();
      expect(screen.getByPlaceholderText("30").hasAttribute("disabled")).toBe(false);
      expect(screen.getByLabelText("Duration unit").hasAttribute("disabled")).toBe(false);
    });
  });

  it("marks the cliff field specifically as optional", () => {
    const element = CreateStreamFields(defaultProps);
    const renderedOutput = JSON.stringify(element);

    // Assert the optional indicator is present on the cliff field
    expect(renderedOutput).toContain("Cliff (optional)");
    
    // Assert required fields do NOT have the optional indicator
    expect(renderedOutput).not.toContain("Recipient address (optional)");
    expect(renderedOutput).not.toContain("Token contract id (optional)");
    expect(renderedOutput).not.toContain("Amount (optional)");
    expect(renderedOutput).not.toContain("Start (optional)");
    expect(renderedOutput).not.toContain("End (optional)");
  });

  describe('the "Use now" button', () => {
    it("sets start to the current time, rounded to the minute", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 7, 27, 10, 15, 32));

      const onFieldChange = vi.fn();
      render(<CreateStreamFields {...defaultProps} onFieldChange={onFieldChange} />);

      fireEvent.click(screen.getByRole("button", { name: "Set start to the current time" }));

      expect(onFieldChange).toHaveBeenCalledWith("start", "2026-08-27T10:15");

      vi.useRealTimers();
    });

    it("is offered only for the start field, not end or cliff", () => {
      render(<CreateStreamFields {...defaultProps} />);

      expect(screen.getAllByRole("button", { name: "Set start to the current time" })).toHaveLength(
        1,
      );
    });
  });

  describe("the past-start hint", () => {
    it("appears under Start when the start time is in the past", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 7, 27, 10, 0, 0));

      render(
        <CreateStreamFields
          {...defaultProps}
          values={{ ...defaultProps.values, start: "2026-08-26T10:00" }}
        />,
      );

      expect(screen.getByText(/vest and become withdrawable immediately/)).toBeTruthy();

      vi.useRealTimers();
    });

    it("does not appear when the start time is in the future", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 7, 27, 10, 0, 0));

      render(
        <CreateStreamFields
          {...defaultProps}
          values={{ ...defaultProps.values, start: "2026-08-28T10:00" }}
        />,
      );

      expect(screen.queryByText(/vest and become withdrawable immediately/)).toBeNull();

      vi.useRealTimers();
    });

    it("does not appear when start is empty", () => {
      render(<CreateStreamFields {...defaultProps} />);

      expect(screen.queryByText(/vest and become withdrawable immediately/)).toBeNull();
    });

    it("does not block submission — the submit button stays enabled", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 7, 27, 10, 0, 0));

      render(
        <CreateStreamFields
          {...defaultProps}
          values={{ ...defaultProps.values, start: "2026-08-26T10:00" }}
        />,
      );

      expect(screen.getByRole("button", { name: "Review stream" }).hasAttribute("disabled")).toBe(
        false,
      );

      vi.useRealTimers();
    });

    it("does not appear when Start itself has a validation error", () => {
      render(
        <CreateStreamFields
          {...defaultProps}
          values={{ ...defaultProps.values, start: "2020-01-01T00:00" }}
          errors={{ start: "Start date is required." }}
        />,
      );

      expect(screen.queryByText(/vest and become withdrawable immediately/)).toBeNull();
    });
  });

  describe("the self-recipient hint", () => {
    const WALLET = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

    it("appears when the recipient matches the connected wallet", () => {
      render(
        <CreateStreamFields
          {...defaultProps}
          walletAddress={WALLET}
          values={{ ...defaultProps.values, recipient: WALLET }}
        />,
      );

      expect(screen.getByText("You are streaming to yourself.")).toBeTruthy();
    });

    it("ignores case when comparing the recipient to the connected wallet", () => {
      render(
        <CreateStreamFields
          {...defaultProps}
          walletAddress={WALLET}
          values={{ ...defaultProps.values, recipient: WALLET.toLowerCase() }}
        />,
      );

      expect(screen.getByText("You are streaming to yourself.")).toBeTruthy();
    });

    it("does not appear for a different recipient", () => {
      render(
        <CreateStreamFields
          {...defaultProps}
          walletAddress={WALLET}
          values={{
            ...defaultProps.values,
            recipient: "GBBZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
          }}
        />,
      );

      expect(screen.queryByText("You are streaming to yourself.")).toBeNull();
    });

    it("does not appear when no wallet is connected", () => {
      render(
        <CreateStreamFields
          {...defaultProps}
          walletAddress={null}
          values={{ ...defaultProps.values, recipient: WALLET }}
        />,
      );

      expect(screen.queryByText("You are streaming to yourself.")).toBeNull();
    });

    it("does not appear when the recipient field is empty", () => {
      render(<CreateStreamFields {...defaultProps} walletAddress={WALLET} />);

      expect(screen.queryByText("You are streaming to yourself.")).toBeNull();
    });

    it("does not block submission — the submit button stays enabled", () => {
      render(
        <CreateStreamFields
          {...defaultProps}
          walletAddress={WALLET}
          values={{ ...defaultProps.values, recipient: WALLET }}
        />,
      );

      expect(screen.getByRole("button", { name: "Review stream" }).hasAttribute("disabled")).toBe(
        false,
      );
    });

    it("does not appear when the recipient field has a validation error", () => {
      render(
        <CreateStreamFields
          {...defaultProps}
          walletAddress={WALLET}
          values={{ ...defaultProps.values, recipient: WALLET }}
          errors={{ recipient: "Must be a valid G... or C... Stellar address." }}
        />,
      );

      expect(screen.queryByText("You are streaming to yourself.")).toBeNull();
    });
  });

  describe("the long-duration warning", () => {
    it("appears under End when the stream would run more than ten years", () => {
      render(
        <CreateStreamFields
          {...defaultProps}
          values={{ ...defaultProps.values, start: "2026-08-27T10:00", end: "2062-08-27T10:00" }}
        />,
      );

      expect(screen.getByText(/This stream will run for 36 years/)).toBeTruthy();
    });

    it("does not appear for a shorter duration", () => {
      render(
        <CreateStreamFields
          {...defaultProps}
          values={{ ...defaultProps.values, start: "2026-08-27T10:00", end: "2030-08-27T10:00" }}
        />,
      );

      expect(screen.queryByText(/more than ten years/)).toBeNull();
    });

    it("does not appear on the Start or Cliff fields, only End", () => {
      render(
        <CreateStreamFields
          {...defaultProps}
          values={{
            ...defaultProps.values,
            start: "2026-08-27T10:00",
            end: "2062-08-27T10:00",
            cliff: "2027-08-27T10:00",
          }}
        />,
      );

      expect(screen.getAllByText(/more than ten years/)).toHaveLength(1);
    });

    it("does not block submission — the submit button stays enabled", () => {
      render(
        <CreateStreamFields
          {...defaultProps}
          values={{ ...defaultProps.values, start: "2026-08-27T10:00", end: "2062-08-27T10:00" }}
        />,
      );

      expect(screen.getByRole("button", { name: "Review stream" }).hasAttribute("disabled")).toBe(
        false,
      );
    });

    it("does not appear when the End field has a validation error", () => {
      render(
        <CreateStreamFields
          {...defaultProps}
          values={{ ...defaultProps.values, start: "2026-08-27T10:00", end: "2062-08-27T10:00" }}
          errors={{ end: "End must be after start." }}
        />,
      );

      expect(screen.queryByText(/more than ten years/)).toBeNull();
    });
  });

  describe('the "Use XLM" button', () => {
    it("fills the token field with the configured network's native asset contract", () => {
      const onFieldChange = vi.fn();
      render(<CreateStreamFields {...defaultProps} onFieldChange={onFieldChange} />);

      fireEvent.click(screen.getByRole("button", { name: "Use native XLM as the token" }));

      expect(onFieldChange).toHaveBeenCalledWith("token", nativeAssetContractId());
    });
  });

  describe("the remembered token", () => {
    const TOKEN = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

    it("offers no clear control when nothing is remembered", () => {
      render(<CreateStreamFields {...defaultProps} />);

      expect(screen.queryByText("Clear saved token")).toBeNull();
    });

    it("clears the remembered token, and the field while it still shows it", () => {
      const onClearRememberedToken = vi.fn();
      const onFieldChange = vi.fn();
      render(
        <CreateStreamFields
          {...defaultProps}
          values={{ ...defaultProps.values, token: TOKEN }}
          rememberedToken={TOKEN}
          onClearRememberedToken={onClearRememberedToken}
          onFieldChange={onFieldChange}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Clear saved token" }));

      expect(onClearRememberedToken).toHaveBeenCalled();
      expect(onFieldChange).toHaveBeenCalledWith("token", "");
    });

    it("leaves an edited token alone when the remembered one is cleared", () => {
      const onClearRememberedToken = vi.fn();
      const onFieldChange = vi.fn();
      render(
        <CreateStreamFields
          {...defaultProps}
          values={{ ...defaultProps.values, token: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" }}
          rememberedToken={TOKEN}
          onClearRememberedToken={onClearRememberedToken}
          onFieldChange={onFieldChange}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Clear saved token" }));

      expect(onClearRememberedToken).toHaveBeenCalled();
      expect(onFieldChange).not.toHaveBeenCalled();
    });
  });

  describe("schedule presets", () => {
    it("renders the preset buttons and triggers onApplyPreset on click", () => {
      const onApplyPreset = vi.fn();
      render(<CreateStreamFields {...defaultProps} onApplyPreset={onApplyPreset} />);

      expect(screen.getByRole("group", { name: "Schedule presets" })).toBeTruthy();
      const monthBtn = screen.getByRole("button", { name: "1 month, linear" });
      const yearBtn = screen.getByRole("button", { name: "1 year, 3-month cliff" });
      const fourYearsBtn = screen.getByRole("button", { name: "4 years, 1-year cliff" });

      expect(monthBtn).toBeTruthy();
      expect(yearBtn).toBeTruthy();
      expect(fourYearsBtn).toBeTruthy();

      fireEvent.click(monthBtn);
      expect(onApplyPreset).toHaveBeenCalledWith("one-month-linear");

      fireEvent.click(yearBtn);
      expect(onApplyPreset).toHaveBeenCalledWith("one-year-three-month-cliff");
    });
  });

  describe("decimals notice", () => {
    it("renders decimalsNotice when provided", () => {
      render(
        <CreateStreamFields
          {...defaultProps}
          decimalsNotice="Could not read decimals from token contract. Defaulting to 7 decimals."
        />,
      );

      expect(
        screen.getByText("Could not read decimals from token contract. Defaulting to 7 decimals."),
      ).toBeTruthy();
    });
  });

  describe("mobile keyboard / autocorrect attributes", () => {
    it("recipient input has spellCheck=false, autoCapitalize=off, autoComplete=off", () => {
      render(<CreateStreamFields {...defaultProps} />);
      const input = document.getElementById("field-recipient") as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.getAttribute("spellcheck")).toBe("false");
      expect(input.getAttribute("autocapitalize")).toBe("off");
      expect(input.getAttribute("autocomplete")).toBe("off");
    });

    it("token input has spellCheck=false, autoCapitalize=off, autoComplete=off", () => {
      render(<CreateStreamFields {...defaultProps} />);
      const input = document.getElementById("field-token") as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.getAttribute("spellcheck")).toBe("false");
      expect(input.getAttribute("autocapitalize")).toBe("off");
      expect(input.getAttribute("autocomplete")).toBe("off");
    });

    it("amount input keeps inputMode=decimal and does not set autoCapitalize", () => {
      render(<CreateStreamFields {...defaultProps} />);
      const input = document.getElementById("field-amount") as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.getAttribute("inputmode")).toBe("decimal");
      expect(input.getAttribute("autocapitalize")).toBeNull();
    });
  });
});
