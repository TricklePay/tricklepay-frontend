import { describe, expect, it } from "vitest";

import { BrandSpinner } from "./brand-spinner";

describe("BrandSpinner", () => {
  it("renders a status element for screen readers", () => {
    const element = BrandSpinner({});
    expect(element.type).toBe("span");
    expect(element.props.role).toBe("status");
  });

  it("exposes the default accessible label as visually-hidden text", () => {
    const element = BrandSpinner({});
    const [, labelSpan] = element.props.children;
    expect(labelSpan.props.className).toBe("sr-only");
    expect(labelSpan.props.children).toBe("Loading");
  });

  it("exposes a custom label when one is provided", () => {
    const element = BrandSpinner({ label: "Loading TricklePay" });
    const [, labelSpan] = element.props.children;
    expect(labelSpan.props.children).toBe("Loading TricklePay");
  });

  it("hides the decorative dots from assistive technology", () => {
    const element = BrandSpinner({});
    const [dots] = element.props.children;
    expect(dots.props["aria-hidden"]).toBe("true");
  });

  it("renders for every size variant without losing the accessible label", () => {
    for (const size of ["sm", "md", "lg"] as const) {
      const element = BrandSpinner({ size, label: "Loading" });
      expect(element.props.role).toBe("status");
      const [, labelSpan] = element.props.children;
      expect(labelSpan.props.children).toBe("Loading");
    }
  });
});
