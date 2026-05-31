import Link from "next/link";

/** Brand tokens for legal/policy pages (light + dark). */
export const POLICY_BRAND = {
  dark: "#221913",
  medium: "#603b1c",
  gradientStart: "#9a632a",
  gradientEnd: "#c18c43",
  accent: "#e3ba65",
} as const;

export function PolicySectionHeading({
  id,
  number,
  title,
}: {
  id?: string;
  number: string;
  title: string;
}) {
  return (
    <h2
      id={id}
      className="mt-12 mb-4 scroll-mt-24 text-2xl font-bold text-[#221913] dark:text-foreground"
    >
      {number}. {title}
    </h2>
  );
}

export function PolicySubHeading({ number, title }: { number: string; title: string }) {
  return (
    <h3 className="mt-8 mb-3 text-lg font-bold text-[#603b1c] dark:text-[#e3ba65]">
      {number} {title}
    </h3>
  );
}

export function PolicyP({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-[15px] leading-relaxed text-foreground/90">{children}</p>;
}

export function PolicyBulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mb-4 space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className="list-disc text-[15px] leading-relaxed text-foreground/90 marker:text-[#c18c43] dark:marker:text-[#e3ba65]"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

export function PolicyCallout({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="my-5 rounded-lg border-l-4 border-[#c18c43] bg-[rgba(227,186,101,0.08)] px-5 py-4 dark:border-[#e3ba65] dark:bg-[rgba(227,186,101,0.12)]"
    >
      <span className="mb-1 block text-sm font-bold uppercase tracking-wide text-[#603b1c] dark:text-[#e3ba65]">
        {label}
      </span>
      <div className="text-[15px] leading-relaxed text-foreground/90">{children}</div>
    </div>
  );
}

export function PolicyLabelBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <span className="mb-1 block text-sm font-bold uppercase tracking-wide text-[#603b1c] dark:text-[#e3ba65]">
        {label}
      </span>
      <div className="text-[15px] leading-relaxed text-foreground/90">{children}</div>
    </div>
  );
}

export function PolicyContactBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 space-y-2 rounded-lg border border-border bg-surface p-5 text-[15px] leading-relaxed text-foreground/90 dark:border-[#e3ba65]/25 [&_strong]:font-semibold [&_strong]:text-[#603b1c] dark:[&_strong]:text-[#e3ba65]">
      {children}
    </div>
  );
}

export function PolicyInlineLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="font-medium text-[#c18c43] underline hover:text-[#9a632a] dark:text-[#e3ba65] dark:hover:text-[#f0d48a]"
    >
      {children}
    </Link>
  );
}

export function PolicyMailLink({ email }: { email: string }) {
  return (
    <a
      href={`mailto:${email}`}
      className="font-medium text-[#c18c43] underline hover:text-[#9a632a] dark:text-[#e3ba65] dark:hover:text-[#f0d48a]"
    >
      {email}
    </a>
  );
}

export function PolicyHero({
  title,
  subtitle,
  dateLine,
}: {
  title: string;
  subtitle: string;
  dateLine: string;
}) {
  return (
    <div
      className="py-16 text-white"
      style={{
        background: `linear-gradient(135deg, ${POLICY_BRAND.dark} 0%, ${POLICY_BRAND.medium} 100%)`,
      }}
    >
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-3 text-lg opacity-90">{subtitle}</p>
        <p className="mt-2 text-sm text-[#e3ba65]">{dateLine}</p>
      </div>
    </div>
  );
}

export function PolicyUpdatedBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-lg border border-[#e3ba65]/25 bg-[rgba(227,186,101,0.12)] px-5 py-4 text-center text-sm text-card-foreground dark:border-[#e3ba65]/35 dark:bg-[#1e3148] [&_strong]:font-semibold [&_strong]:text-inherit">
      {children}
    </div>
  );
}

export function PolicyFooterNav({
  links,
}: {
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm">
      {links.map((link, i) => (
        <span key={link.href} className="contents">
          {i > 0 ? <span className="text-muted-foreground">·</span> : null}
          <Link
            href={link.href}
            className="font-medium text-[#c18c43] hover:underline dark:text-[#e3ba65] dark:hover:text-[#f0d48a]"
          >
            {link.label}
          </Link>
        </span>
      ))}
    </div>
  );
}
