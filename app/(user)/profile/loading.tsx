export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <section>
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-muted" />
      </section>
      <section className="rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-6 sm:py-7">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
          <div className="h-10 w-32 ml-auto animate-pulse rounded-lg bg-muted" />
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-6 sm:py-7">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-4 flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-10 w-32 animate-pulse rounded-lg bg-muted" />
        </div>
      </section>
    </div>
  );
}
