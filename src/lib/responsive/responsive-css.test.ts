import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readCss(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("responsive CSS foundations (Phase 43)", () => {
  it("does not use drifted public/admin breakpoints in layouts.css", () => {
    const css = readCss("src/styles/layouts.css");
    expect(css).not.toMatch(/@media \(min-width: 640px\)/);
    expect(css).not.toMatch(/@media \(min-width: 720px\)/);
    expect(css).not.toMatch(/@media \(min-width: 900px\)/);
    expect(css).not.toMatch(/@media \(min-width: 960px\)/);
    expect(css).not.toMatch(/47\.99rem/);
  });

  it("uses canonical admin dual-layout and booking sticky breakpoints", () => {
    const css = readCss("src/styles/layouts.css");
    expect(css).toContain("@media (min-width: 64rem)");
    expect(css).toContain("@media (max-width: 1023px)");
    expect(css).toContain("@media (min-width: 768px)");
    expect(css).toContain("booking-wizard__nav");
    expect(css).toContain("env(safe-area-inset-bottom");
  });

  it("exports viewportFit cover from root layout", () => {
    const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
    expect(layout).toContain("viewportFit: \"cover\"");
    expect(layout).toContain("export const viewport");
  });
});
