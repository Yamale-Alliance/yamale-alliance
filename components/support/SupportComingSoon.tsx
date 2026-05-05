import Link from "next/link";

type Variant = "user" | "admin";

export function SupportComingSoon({ variant = "user" }: { variant?: Variant }) {
  if (variant === "admin") {
    return (
      <div className="rounded-xl border border-border bg-muted/30 px-6 py-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coming soon</p>
        <h1 className="heading mt-2 text-2xl font-bold text-foreground">Support queue</h1>
        <p className="mt-3 max-w-lg text-muted-foreground">
          Ticket notifications need a verified sending domain (for example via Resend). When DNS is ready, set{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPPORT_CENTER_ENABLED=1</code> and
          configure email env vars. Until then, the queue API stays off.
        </p>
        <p className="mt-4">
          <Link href="/admin-panel" className="font-medium text-primary underline-offset-4 hover:underline">
            ← Admin home
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 px-6 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coming soon</p>
      <h1 className="heading mt-2 text-2xl font-bold text-foreground">Support centre</h1>
      <p className="mt-3 max-w-lg text-muted-foreground">
        Opening tickets and email notifications need a verified sending domain (for example via Resend). Once your DNS
        is set up, we’ll turn this on. You can still use{" "}
        <Link href="/account" className="font-medium text-primary underline-offset-4 hover:underline">
          Account
        </Link>{" "}
        for profile, subscription, purchases, and unlocked lawyers.
      </p>
    </div>
  );
}
