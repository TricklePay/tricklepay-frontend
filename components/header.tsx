import Link from "next/link";
import { WalletButton } from "@/components/wallet-button";

export function Header() {
  return (
    <header className="border-b border-neutral-800">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <nav className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold">
            TricklePay
          </Link>
          <Link href="/create" className="text-sm text-neutral-400 hover:text-neutral-100">
            New stream
          </Link>
        </nav>
        <WalletButton />
      </div>
    </header>
  );
}
