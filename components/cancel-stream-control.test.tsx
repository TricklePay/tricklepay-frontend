import { describe, expect, it, vi } from "vitest";

import { CancelStreamControl } from "./cancel-stream-control";

describe("CancelStreamControl", () => {
  it("requires a confirmation step before the actual cancel action fires", () => {
    const onRequestCancel = vi.fn();
    const onConfirm = vi.fn();
    const onDismiss = vi.fn();

    // 1. Initial state: not confirming
    const initialElement = CancelStreamControl({
      confirming: false,
      busy: false,
      cancelling: false,
      onRequestCancel,
      onConfirm,
      onDismiss,
    });

    // Assert it renders a button that requests cancellation instead of immediately confirming
    expect(initialElement.type).toBe("button");
    
    // Simulate clicking the initial button
    initialElement.props.onClick();
    expect(onRequestCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();

    // 2. Confirmation state: confirming is true
    const confirmingElement = CancelStreamControl({
      confirming: true,
      busy: false,
      cancelling: false,
      onRequestCancel,
      onConfirm,
      onDismiss,
    });

    // Assert it renders the alertdialog confirmation
    expect(confirmingElement.props.role).toBe("alertdialog");

    // The alertdialog contains a message and a div with buttons
    const [, actionsDiv] = confirmingElement.props.children;
    const [confirmBtn, dismissBtn] = actionsDiv.props.children;
    expect(confirmingElement.props.children[0].props.children).toContain(
      "The vested balance is claimable by the recipient",
    );

    // Triggering the confirm button should now fire onConfirm
    confirmBtn.props.onClick();
    expect(onConfirm).toHaveBeenCalled();

    // Triggering dismiss should fire onDismiss
    dismissBtn.props.onClick();
    expect(onDismiss).toHaveBeenCalled();
  });
});
