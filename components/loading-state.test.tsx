import { describe, it, expect } from "vitest";
import { LoadingState } from "./loading-state";

describe("LoadingState", () => {
  it("renders the list skeleton variant", () => {
    const el = LoadingState({ variant: "list", listCount: 2 });
    expect(el.type.name).toBe("StreamListSkeleton");
    expect(el.props.count).toBe(2);
  });

  it("renders the detail skeleton variant", () => {
    const el = LoadingState({ variant: "detail" });
    expect(el.type.name).toBe("StreamDetailSkeleton");
  });

  it("renders the generic spinner variant with the provided label", () => {
    const el = LoadingState({
      variant: "generic",
      label: "Loading TricklePay",
      spinnerSize: "lg",
    });
    expect(el.type).toBe("main");
    expect(el.props.children.type.name).toBe("BrandSpinner");
    expect(el.props.children.props.label).toBe("Loading TricklePay");
    expect(el.props.children.props.size).toBe("lg");
  });
});
