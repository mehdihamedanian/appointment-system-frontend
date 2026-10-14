import axe from "axe-core";

/**
 * Runs axe-core against rendered markup. jsdom has no layout or computed
 * colours, so contrast is verified against design tokens separately and
 * page-level landmark rules are skipped for isolated components.
 */
export async function axeViolations(root: Element = document.body): Promise<string[]> {
  const result = await axe.run(root, {
    rules: {
      "color-contrast": { enabled: false },
      region: { enabled: false },
      "landmark-one-main": { enabled: false },
      "page-has-heading-one": { enabled: false },
    },
  });
  return result.violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")} — ${node.failureSummary ?? ""}`),
  );
}
