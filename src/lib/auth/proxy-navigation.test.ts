import { describe, expect, it } from "vitest";
import { resolveProxyNavigation } from "@/lib/auth/proxy-navigation";

describe("proxy navigation", () => {
  it("sends anonymous visitors away from customer routes", () => {
    expect(
      resolveProxyNavigation({
        pathname: "/dashboard",
        hasSessionCookie: false,
      }),
    ).toEqual({
      type: "redirect",
      location: "/login?redirect=%2Fdashboard",
    });
  });

  it("sends anonymous visitors away from admin routes", () => {
    expect(
      resolveProxyNavigation({
        pathname: "/admin/appointments",
        hasSessionCookie: false,
      }),
    ).toEqual({
      type: "redirect",
      location: "/admin/login?redirect=%2Fadmin%2Fappointments",
    });
  });

  it("lets anonymous visitors reach admin login", () => {
    expect(
      resolveProxyNavigation({
        pathname: "/admin/login",
        hasSessionCookie: false,
      }),
    ).toEqual({ type: "next" });
  });

  it("keeps authenticated visitors off anonymous auth routes", () => {
    expect(
      resolveProxyNavigation({
        pathname: "/login",
        redirectParam: "/appointments",
        hasSessionCookie: true,
      }),
    ).toEqual({
      type: "redirect",
      location: "/appointments",
    });
  });

  it("sends anonymous visitors away from customer appointment lists", () => {
    expect(
      resolveProxyNavigation({
        pathname: "/appointments",
        search: "?category=upcoming",
        hasSessionCookie: false,
      }),
    ).toEqual({
      type: "redirect",
      location: "/login?redirect=%2Fappointments%3Fcategory%3Dupcoming",
    });
  });
});
