"use client";

export function ClientsList() {
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="rounded-2xl border border-border bg-card px-4 py-6 shadow-sm sm:px-6 sm:py-8 md:px-8 md:py-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          My Clients
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          View and manage your client list. Clients will appear here when they connect with you via the lawyer directory.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-6 sm:p-8">
          <p className="text-sm text-muted-foreground text-center">
            No clients yet. Clients will appear here when they unlock your contact from the Find a Lawyer page and reach out.
          </p>
        </div>
      </div>
    </div>
  );
}
