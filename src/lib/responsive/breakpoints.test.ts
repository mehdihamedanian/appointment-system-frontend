import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  BREAKPOINTS,
  MEDIA_MAX_LG,
  MEDIA_MAX_MD,
  MEDIA_MIN_LG,
  MEDIA_MIN_MD,
  isAdminDrawerViewport,
  isMobileViewport,
  matchesMedia,
} from "@/lib/responsive/breakpoints";

describe("responsive breakpoints (Phase 43)", () => {
  it("matches design tokens (sm/md/lg/xl)", () => {
    expect(BREAKPOINTS).toEqual({
      sm: 480,
      md: 768,
      lg: 1024,
      xl: 1280,
    });
  });

  it("uses below-md / below-lg queries aligned with CSS", () => {
    expect(MEDIA_MAX_MD).toBe("(max-width: 767px)");
    expect(MEDIA_MIN_MD).toBe("(min-width: 768px)");
    expect(MEDIA_MAX_LG).toBe("(max-width: 1023px)");
    expect(MEDIA_MIN_LG).toBe("(min-width: 1024px)");
  });

  describe("matchMedia helpers", () => {
    const listeners = new Set<() => void>();
    let matches = false;

    beforeEach(() => {
      matches = false;
      listeners.clear();
      vi.stubGlobal(
        "matchMedia",
        vi.fn((query: string) => ({
          media: query,
          get matches() {
            return matches;
          },
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: (_: string, cb: () => void) => {
            listeners.add(cb);
          },
          removeEventListener: (_: string, cb: () => void) => {
            listeners.delete(cb);
          },
          dispatchEvent: vi.fn(),
        })),
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("reports mobile and admin-drawer viewports from matchMedia", () => {
      matches = true;
      expect(matchesMedia(MEDIA_MAX_MD)).toBe(true);
      expect(isMobileViewport()).toBe(true);
      expect(isAdminDrawerViewport()).toBe(true);
      matches = false;
      expect(isMobileViewport()).toBe(false);
      expect(isAdminDrawerViewport()).toBe(false);
    });
  });
});
