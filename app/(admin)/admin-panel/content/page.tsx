import Link from "next/link";
import { BookOpen, Store, Briefcase } from "lucide-react";

const contentLinks = [
  {
    href: "/admin-panel/laws",
    label: "Library & laws",
    description: "Add, update, and curate the legal library.",
    icon: BookOpen,
  },
  {
    href: "/admin-panel/marketplace",
    label: "The Yamale Vault items",
    description: "Manage books, courses, and templates for sale.",
    icon: Store,
  },
  {
    href: "/admin-panel/lawyers",
    label: "Lawyers directory",
    description: "Maintain lawyer profiles shown to users.",
    icon: Briefcase,
  },
];

export default function AdminContentPage() {
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="rounded-2xl border border-border bg-card px-4 py-6 shadow-sm sm:px-6 sm:py-8 md:px-8 md:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Content Management</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Manage the core content that powers the platform: library entries, The Yamale Vault products,
          and the lawyer directory.
        </p>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">Content areas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose what you want to manage.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {contentLinks.map(({ href, label, description, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{label}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

