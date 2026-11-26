import axe from "axe-core";

/**
 * Runs axe against a rendered container and returns readable violations.
 * `color-contrast` is off because jsdom does no layout or painting, so axe
 * cannot compute colours there; contrast is covered in the browser by e2e.
 * Pass `knownViolations` (rule ids, each linked to an issue) to track an
 * existing violation without hiding new ones, and `enabledRules` to turn on
 * experimental rules that axe-core disables by default.
 */
export async function axeViolations(
  container: Element,
  knownViolations: string[] = [],
  enabledRules: string[] = [],
): Promise<string[]> {
  const rules: Record<string, { enabled: boolean }> = { "color-contrast": { enabled: false } };
  for (const id of enabledRules) rules[id] = { enabled: true };
  for (const id of knownViolations) rules[id] = { enabled: false };

  const { violations } = await axe.run(container, { rules, resultTypes: ["violations"] });
  return violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help} at ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
}
