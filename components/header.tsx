"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { WalletButton } from "@/components/wallet-button";

const NAV_LINKS = [
  { href: "/", label: "Streams" },
  { href: "/create", label: "New stream" },
];

export function Header(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever the user navigates to a new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="border-b border-neutral-800">
      {/* Desktop / top bar */}
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        {/* Logo — always visible */}
        <Link href="/" className="text-lg font-semibold">
          TricklePay
        </Link>

        {/* Desktop nav links (hidden on mobile) */}
        <nav aria-label="Main navigation" className="hidden items-center gap-6 sm:flex">
          {NAV_LINKS.filter((l) => l.href !== "/").map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-neutral-400 hover:text-neutral-100"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side: theme toggle + wallet + hamburger */}
        <div className="flex items-center gap-3">
          {/* Theme toggle is always visible */}
          <ThemeToggle />

          {/* Wallet button is always visible */}
          <WalletButton />

          {/* Hamburger — only on mobile */}
          <button
            type="button"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center justify-center rounded border border-neutral-700 p-1.5 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 sm:hidden"
          >
            {open ? (
              /* × close icon */
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
              </svg>
            ) : (
              /* ≡ hamburger icon */
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M1.75 3.5a.75.75 0 0 0 0 1.5h12.5a.75.75 0 0 0 0-1.5H1.75ZM1 8.75a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 8.75Zm.75 3.75a.75.75 0 0 0 0 1.5h12.5a.75.75 0 0 0 0-1.5H1.75Z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile navigation"
          className="border-t border-neutral-800 sm:hidden"
        >
          <ul className="mx-auto max-w-4xl space-y-1 px-6 py-3">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`block rounded px-3 py-2 text-sm transition-colors ${
                    pathname === link.href
                      ? "bg-neutral-800 text-neutral-100"
                      : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-100"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
