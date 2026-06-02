export default function MarketplaceLoading() {
  return (
    <div className="min-h-screen">
      <div className="border-b border-border bg-card/50 px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="h-8 w-72 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded bg-muted" />
          <div className="mt-6 flex flex-wrap gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 w-36 animate-pulse rounded-xl bg-muted sm:w-40" />
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="flex flex-col rounded-xl border border-border bg-card p-5"
            >
              <div className="aspect-[4/3] w-full animate-pulse rounded-lg bg-muted" />
              <div className="mt-4 h-6 w-3/4 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
