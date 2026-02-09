import Link from "next/link";
import { Users, Briefcase, FileText, Settings, Scale, BookOpen } from "lucide-react";

const adminLinks = [
  { href: "/admin-panel/users", label: "Users", icon: Users },
  { href: "/admin-panel/lawyers", label: "Lawyers", icon: Briefcase },
  { href: "/admin-panel/laws", label: "Laws", icon: BookOpen },
  { href: "/admin-panel/pricing", label: "Pricing", icon: Scale },
  { href: "/admin-panel/content", label: "Content", icon: FileText },
  { href: "/admin-panel/settings", label: "Settings", icon: Settings },
];

export function AdminDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Platform administration and management.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {adminLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-xl border border-border p-6 transition-colors hover:bg-accent/50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <span className="font-medium">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
