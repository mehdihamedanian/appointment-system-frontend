import { describe, expect, it } from "vitest";
import { getDocumentLocale } from "@/config/locale";
import { SkipLink } from "@/components/layout/skip-link";
import { render, screen } from "@testing-library/react";

describe("root presentation", () => {
  it("uses Persian RTL as the default document locale", () => {
    expect(getDocumentLocale()).toEqual({ lang: "fa", dir: "rtl" });
  });

  it("renders an accessible skip link to main content", () => {
    render(
      <>
        <SkipLink />
        <main id="main-content">محتوا</main>
      </>,
    );

    const skip = screen.getByRole("link", { name: "رفتن به محتوای اصلی" });
    expect(skip).toHaveAttribute("href", "#main-content");
    expect(document.documentElement).toBeDefined();
  });
});
