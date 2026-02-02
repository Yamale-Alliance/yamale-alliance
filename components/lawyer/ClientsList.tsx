export function ClientsList() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">My Clients</h1>
      <p className="mt-2 text-muted-foreground">
        View and manage your client list.
      </p>
      <div className="mt-8 rounded-xl border border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No clients yet. Clients will appear here when they connect with you.
        </p>
      </div>
    </div>
  );
}
