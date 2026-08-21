"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { IconButton } from "@/components/ui/icon-button";
import { publicNavItems, isNavItemActive } from "@/constants/navigation";
import { routes } from "@/constants/routes";

export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="public-header">
      <Brand />
      <nav className="public-nav desktop-only" aria-label="ناوبری عمومی">
        {publicNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="nav-link"
            aria-current={isNavItemActive(pathname, item.href) ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
        <Link href={routes.customer.booking} className="btn btn--primary">
          رزرو نوبت
        </Link>
      </nav>
      <IconButton
        className="mobile-only"
        label={open ? "بستن منو" : "باز کردن منو"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </IconButton>
      {open ? (
        <div className="drawer-overlay" onClick={() => setOpen(false)}>
          <div
            className="drawer"
            role="dialog"
            aria-label="منوی عمومی"
            onClick={(event) => event.stopPropagation()}
          >
            <nav aria-label="ناوبری عمومی همراه">
              {publicNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-link"
                  aria-current={
                    isNavItemActive(pathname, item.href) ? "page" : undefined
                  }
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href={routes.customer.booking}
                className="btn btn--primary"
                onClick={() => setOpen(false)}
              >
                رزرو نوبت
              </Link>
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
