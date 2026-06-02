import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type VaultPackageSubheaderProps = {
  title: string;
  /**
   * `platform` — sits on the default site background, clearly separate from brown landing HTML.
   * `vault` — dark bar used on built-in vault landings without custom HTML.
   */
  variant?: "platform" | "vault";
};

export function VaultPackageSubheader({ title, variant = "vault" }: VaultPackageSubheaderProps) {
  const isPlatform = variant === "platform";

  return (
    <header
      className={
        isPlatform
          ? "relative z-40 border-b border-border bg-card shadow-sm"
          : "sticky top-[var(--site-nav-h,4.5rem)] z-40 border-b border-[rgba(193,140,67,0.22)] bg-[#1a1410] shadow-[0_6px_20px_rgba(0,0,0,0.35)] sm:top-[var(--site-nav-h,5.5rem)]"
      }
    >
      <div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6 sm:py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Link
            href="/marketplace"
            className={
              isPlatform
                ? "inline-flex w-fit shrink-0 items-center gap-2 text-sm font-medium text-primary transition hover:text-primary/80"
                : "inline-flex w-fit shrink-0 items-center gap-2 text-sm font-medium text-[#E3BA65] transition hover:text-white"
            }
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Back to The Yamalé Vault</span>
            <span className="sm:hidden">Back to Vault</span>
          </Link>
          <span
            className={
              isPlatform
                ? "hidden h-5 w-px shrink-0 bg-border sm:block"
                : "hidden h-5 w-px shrink-0 bg-[rgba(193,140,67,0.35)] sm:block"
            }
            aria-hidden
          />
          <p
            className={
              isPlatform
                ? "min-w-0 text-sm font-medium leading-snug text-muted-foreground sm:text-[0.9375rem]"
                : "min-w-0 text-sm font-medium leading-snug text-white/75 sm:text-[0.9375rem]"
            }
            title={title}
          >
            {title}
          </p>
        </div>
      </div>
    </header>
  );
}
