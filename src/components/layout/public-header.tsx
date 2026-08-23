"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { IconButton } from "@/components/ui/icon-button";
import { isNavItemActive } from "@/constants/navigation";
import { routes } from "@/constants/routes";
import { useSession } from "@/features/auth/session-provider";

type NavLink = { href: string; label: string };

export function PublicHeader({
  businessName,
  logoSrc,
  bookingEnabled = true,
  showProviders = false,
}: {
  businessName?: string;
  logoSrc?: string;
  bookingEnabled?: boolean;
  showProviders?: boolean;
}) {
  const pathname = usePathname();
  const { status, user } = useSession();
  const [open, setOpen] = useState(false);

  const links: NavLink[] = [
    { href: routes.public.home, label: "خانه" },
    { href: routes.public.services, label: "خدمات" },
    { href: "/#about", label: "درباره ما" },
    ...(showProviders ? [{ href: "/#providers", label: "همکاران" }] : []),
    { href: "/#contact", label: "تماس" },
    { href: "/#hours", label: "ساعات کاری" },
  ];

  const account =
    status === "authenticated" && user ? (
      <Link href={routes.customer.dashboard} className="nav-link">
        حساب من
      </Link>
    ) : status === "loading" ? null : (
      <Link href={routes.auth.login} className="nav-link">
        ورود
      </Link>
    );

  const booking = bookingEnabled ? (
    <Button asChild>
      <Link href={routes.customer.booking}>رزرو نوبت</Link>
    </Button>
  ) : null;

  return (
    <header className="public-header">
      <Brand compact name={businessName} logoSrc={logoSrc} />
      <nav className="public-nav desktop-only" aria-label="ناوبری عمومی">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="nav-link"
            aria-current={isNavItemActive(pathname, item.href) ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
        {account}
        {booking}
      </nav>
      <IconButton
        className="mobile-only"
        label={open ? "بستن منو" : "باز کردن منو"}
        aria-expanded={open}
        aria-controls="public-mobile-nav"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </IconButton>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="منوی عمومی"
        placement="end"
      >
        <nav id="public-mobile-nav" className="public-drawer-nav" aria-label="ناوبری عمومی همراه">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <span onClick={() => setOpen(false)}>{account}</span>
          {bookingEnabled ? (
            <Button asChild>
              <Link href={routes.customer.booking} onClick={() => setOpen(false)}>
                رزرو نوبت
              </Link>
            </Button>
          ) : null}
        </nav>
      </Drawer>
    </header>
  );
}
