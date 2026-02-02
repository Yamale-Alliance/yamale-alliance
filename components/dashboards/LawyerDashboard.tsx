import Link from "next/link";
import { Users, FileText } from "lucide-react";

export function LawyerDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Lawyer Panel</h1>
      <p className="mt-2 text-muted-foreground">
        Manage your practice and clients on Yamalé.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/my-clients"
          className="flex items-center gap-4 rounded-xl border border-border p-6 transition-colors hover:bg-accent/50"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <span className="font-medium">My Clients</span>
            <p className="text-sm text-muted-foreground">
              View and manage your client list
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-4 rounded-xl border border-border p-6 opacity-60">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <span className="font-medium">Profile</span>
            <p className="text-sm text-muted-foreground">Coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
