import Link from "next/link";
import { PlatformLogo } from "@/components/platform/PlatformLogo";

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/** Branded wrapper for sign-in / sign-up — matches site navy & cream palette. */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-10 sm:py-14">
      <div className="overflow-visible rounded-xl border border-border bg-card p-6 shadow-[0_4px_24px_rgba(13,27,42,0.08)] sm:p-8">
        <Link
          href="/"
          className="mb-6 inline-flex transition-opacity hover:opacity-90"
          aria-label="Yamalé home"
        >
          <PlatformLogo height={48} width={180} className="h-12 w-[180px]" />
        </Link>
        <h1 className="heading text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p> : null}
        <div className="yamale-auth-clerk mt-6 overflow-visible">{children}</div>
      </div>
      {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  );
}
