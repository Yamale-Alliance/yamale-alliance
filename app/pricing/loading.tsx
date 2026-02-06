export default function PricingLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="text-white py-20" style={{ background: "linear-gradient(135deg, #221913 0%, #603b1c 100%)" }}>
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="h-12 w-96 mx-auto animate-pulse rounded bg-white/20" />
          <div className="mt-4 h-6 w-2/3 mx-auto animate-pulse rounded bg-white/20" />
          <div className="mt-10 h-10 w-48 mx-auto animate-pulse rounded bg-white/20" />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 -mt-10 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl shadow-lg border-2 border-[#e3ba65]/50 p-8">
              <div className="h-8 w-24 mx-auto animate-pulse rounded bg-muted" />
              <div className="mt-4 h-12 w-32 mx-auto animate-pulse rounded bg-muted" />
              <div className="mt-4 h-4 w-full animate-pulse rounded bg-muted" />
              <div className="mt-6 h-10 w-full animate-pulse rounded bg-muted" />
              <div className="mt-6 space-y-3">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-4 w-full animate-pulse rounded bg-muted" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
