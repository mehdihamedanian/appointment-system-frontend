import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { loginAsCustomer, loginAsOwner } from "./support/auth";
import { apiAuth, backend, book, nextOpenSlot, registerCustomer } from "./support/backend";
import { runId } from "./support/env";

/**
 * Release quality gates on real pages of the isolated stack: WCAG 2.1 A/AA (axe-core),
 * Persian RTL document setup, no horizontal overflow on phone/tablet/desktop widths,
 * no uncaught page errors, and navigation/LCP timings (attached to the report).
 */

const axeSource = readFileSync(join(process.cwd(), "node_modules/axe-core/axe.min.js"), "utf8");
const password = "E2e-Quality-Pass-1";
const customerMobile = `0915${String(Date.now()).slice(-7)}`;

const viewports = [
  { name: "phone", width: 360, height: 780 },
  { name: "large phone", width: 414, height: 896 },
  { name: "tablet portrait", width: 768, height: 1024 },
  { name: "tablet landscape", width: 1024, height: 768 },
  { name: "desktop", width: 1366, height: 768 },
];

type Violation = { id: string; impact: string | null; nodes: number; target: string };

async function axeViolations(page: Page): Promise<Violation[]> {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (...args: unknown[]) => Promise<{ violations: unknown[] }> } }).axe;
    const result = await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return (result.violations as { id: string; impact: string | null; nodes: { target: string[] }[] }[]).map(
      (violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
        target: violation.nodes[0]?.target.join(" ") ?? "",
      }),
    );
  });
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
}

async function timings(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ ttfb: number; domContentLoaded: number; load: number; lcp: number | null }>((resolve) => {
        const [nav] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
        let lcp: number | null = null;
        try {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            lcp = entries[entries.length - 1]?.startTime ?? lcp;
          }).observe({ type: "largest-contentful-paint", buffered: true });
        } catch {
          lcp = null;
        }
        setTimeout(
          () =>
            resolve({
              ttfb: Math.round(nav?.responseStart ?? 0),
              domContentLoaded: Math.round(nav?.domContentLoadedEventEnd ?? 0),
              load: Math.round(nav?.loadEventEnd ?? 0),
              lcp: lcp === null ? null : Math.round(lcp),
            }),
          250,
        );
      }),
  );
}

async function audit(page: Page, paths: string[]) {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(`${page.url()}: ${error.message}`));
  const metrics: Record<string, unknown> = {};

  for (const path of paths) {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(path);
    await settle(page);
    metrics[path] = await timings(page);

    const root = await page.evaluate(() => ({
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
    }));
    expect.soft(root, `${path} document direction and language`).toEqual({ dir: "rtl", lang: "fa" });

    const serious = (await axeViolations(page)).filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect.soft(serious, `${path} serious/critical WCAG violations`).toEqual([]);

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect.soft(overflow, `${path} horizontal overflow at ${viewport.name} ${viewport.width}px`).toBeLessThanOrEqual(1);
    }
  }

  await test.info().attach("timings.json", {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });
  test.info().annotations.push({ type: "timings", description: JSON.stringify(metrics) });
  expect(pageErrors, "uncaught page errors").toEqual([]);
}

test.describe("release quality", () => {
  test("public pages", async ({ page }) => {
    await audit(page, ["/", "/login", "/register", "/admin/login", "/services"]);
  });

  test("customer pages", async ({ browser }) => {
    const api = await backend();
    await registerCustomer(api, customerMobile, password, `کیفیت ${runId}`);
    const auth = await apiAuth(api, customerMobile, password);
    const { reference } = await book(api, auth, await nextOpenSlot(api, auth));
    await api.dispose();

    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsCustomer(page, customerMobile, password);
    await audit(page, [
      "/dashboard",
      "/appointments",
      `/appointments/${reference}`,
      `/appointments/${reference}/payment`,
      `/appointments/${reference}/cancel`,
      `/appointments/${reference}/reschedule`,
      "/booking",
      "/payments",
      "/profile",
    ]);
    await context.close();
  });

  test("admin pages", async ({ page }) => {
    await loginAsOwner(page);
    await audit(page, ["/admin", "/admin/calendar", "/admin/appointments", "/admin/services", "/admin/staff"]);
  });
});
