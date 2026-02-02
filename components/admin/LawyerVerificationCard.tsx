interface LawyerVerificationCardProps {
  name: string;
  email: string;
  submittedAt: string;
  documentsCount: number;
}

export function LawyerVerificationCard({
  name,
  email,
  submittedAt,
  documentsCount,
}: LawyerVerificationCardProps) {
  return (
    <div className="rounded-xl border border-border p-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium">{name}</h3>
          <p className="text-sm text-muted-foreground">{email}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Submitted {submittedAt} · {documentsCount} document(s)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            Review
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
