export default function LawDetailLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-[#0D1B2A] px-4 py-10 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="h-4 w-32 animate-pulse rounded bg-white/20" />
          <div className="mt-6 h-10 w-3/4 max-w-2xl animate-pulse rounded bg-white/25" />
          <div className="mt-4 h-5 w-1/2 max-w-md animate-pulse rounded bg-white/15" />
        </div>
      </div>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${90 - i * 8}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
