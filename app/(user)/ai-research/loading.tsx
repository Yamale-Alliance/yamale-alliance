export default function AIResearchLoading() {
  return (
    <div className="fixed left-0 right-0 top-14 z-10 flex h-[calc(100vh-3.5rem)] bg-background">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-2">
          <div className="h-5 w-5 animate-pulse rounded bg-muted" />
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6">
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-8 w-64 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-4 w-96 animate-pulse rounded bg-muted" />
              <div className="mt-10 flex flex-wrap justify-center gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 w-48 animate-pulse rounded-full bg-muted" />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-border bg-background p-4">
          <div className="mx-auto max-w-3xl">
            <div className="h-12 w-full animate-pulse rounded-2xl bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
