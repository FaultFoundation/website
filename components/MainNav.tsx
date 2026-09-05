"use client";

/**
 * Site navigation, redesigned (ff- classes, styles/theme.css §6).
 *
 * Four top-level items, plus the header auth control: an About dropdown for
 * this site's own pages (About / News / Policies), a Partners dropdown for
 * outbound partner destinations (currently just College Esports News), then
 * the Join Discord and Commons pills, then the avatar — which only exists in
 * the DOM's visible state when a Commons session is present. There is no
 * signed-out header control at all; a logged-out visitor gets to Commons via
 * the Commons pill and signs in from there.
 *
 * - Desktop: inline links right of the brand, two dropdowns, then the pills.
 * - Compact (<1100px): hamburger opens a full-screen overlay; Escape and
 *   the close button dismiss it; scroll is locked via html.ff-no-scroll.
 */

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { HeaderAuthButton } from "./auth/HeaderAuthButton";
import { COMMONS_HOME } from "@/lib/commons";

type DropdownId = "about" | "partners";

/** Pages inside the About dropdown, in menu order. */
const ABOUT_PAGES: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/about/", label: "About" },
  { href: "/news/", label: "News" },
  { href: "/policies/", label: "Policies" },
];

/** Outbound partner destinations inside the Partners dropdown. */
const PARTNER_PAGES: ReadonlyArray<{ href: string; label: string }> = [
  { href: "https://collegeesportsnews.org/news/", label: "College Esports News" },
];

function Chevron() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1.5 4L6 8L10.5 4" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * One header dropdown: a button that toggles a submenu of links. `openId` is
 * lifted to NavLinks so opening one dropdown closes the other, rather than
 * having two independently-tracked menus that can both be open at once.
 */
function NavDropdown({
  id,
  label,
  active,
  items,
  openId,
  setOpenId,
  pathname,
}: {
  id: DropdownId;
  label: string;
  active: boolean;
  items: ReadonlyArray<{ href: string; label: string }>;
  openId: DropdownId | null;
  setOpenId: (id: DropdownId | null) => void;
  pathname: string;
}) {
  const groupRef = useRef<HTMLLIElement>(null);
  const open = openId === id;

  // Close this dropdown on click outside / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!groupRef.current?.contains(e.target as Node)) setOpenId(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpenId]);

  return (
    <li ref={groupRef} className={`ff-nav__group${open ? " is-open" : ""}`}>
      <button
        type="button"
        className={`ff-nav__link${active ? " is-current" : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpenId(open ? null : id)}
      >
        {label}
        <Chevron />
      </button>
      <ul className="ff-nav__submenu">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </li>
  );
}

/** Shared menu items (header + footer). */
function NavLinks() {
  const pathname = usePathname();
  const [openId, setOpenId] = useState<DropdownId | null>(null);

  // Article and tag routes sit under /news/, so About has to light up for
  // any of them — not just the three exact hrefs in its menu.
  const inAbout =
    ABOUT_PAGES.some((page) => pathname === page.href) ||
    pathname.startsWith("/news/") ||
    pathname.startsWith("/tag/");

  return (
    <>
      <NavDropdown
        id="about"
        label="About"
        active={inAbout}
        items={ABOUT_PAGES}
        openId={openId}
        setOpenId={setOpenId}
        pathname={pathname}
      />
      <NavDropdown
        id="partners"
        label="Partners"
        active={false}
        items={PARTNER_PAGES}
        openId={openId}
        setOpenId={setOpenId}
        pathname={pathname}
      />
      <li className="ff-nav__cta">
        <a className="ff-btn" href="https://discord.com/invite/76D4TAdymH">
          Join Discord
        </a>
      </li>
      <li className="ff-nav__cta">
        <a className="ff-btn ff-btn--brand" href={COMMONS_HOME}>
          Commons
        </a>
      </li>
      <li className="ff-nav__cta ff-auth-when-in">
        <HeaderAuthButton />
      </li>
    </>
  );
}

/** Header navigation: responsive, hamburger overlay on small screens. */
export function HeaderNav() {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("ff-no-scroll", open);
    if (open) closeButtonRef.current?.focus();
    return () => document.documentElement.classList.remove("ff-no-scroll");
  }, [open]);

  const close = () => {
    setOpen(false);
    openButtonRef.current?.focus();
  };

  return (
    <nav
      className="ff-nav"
      aria-label="Navigation"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) close();
      }}
    >
      <button
        ref={openButtonRef}
        type="button"
        className="ff-nav__open"
        aria-haspopup="dialog"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
      >
        <svg
          width="24"
          height="24"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M5 5v1.5h14V5H5z" />
          <path d="M5 12.8h14v-1.5H5v1.5z" />
          <path d="M5 19h14v-1.5H5V19z" />
        </svg>
      </button>
      <div
        className={`ff-nav__container${open ? " is-open" : ""}`}
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        aria-label={open ? "Menu" : undefined}
      >
        <button
          ref={closeButtonRef}
          type="button"
          className="ff-nav__close"
          aria-label="Close menu"
          onClick={close}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m13.06 12 6.47-6.47-1.06-1.06L12 10.94 5.53 4.47 4.47 5.53 10.94 12l-6.47 6.47 1.06 1.06L12 13.06l6.47 6.47 1.06-1.06L13.06 12Z" />
          </svg>
        </button>
        <ul className="ff-nav__list">
          <NavLinks />
        </ul>
      </div>
    </nav>
  );
}
