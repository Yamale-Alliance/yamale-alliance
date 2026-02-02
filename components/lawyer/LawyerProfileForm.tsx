"use client";

export function LawyerProfileForm() {
  return (
    <form className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Lawyer Profile</h2>
        <p className="text-sm text-muted-foreground">
          Update your professional information.
        </p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Specialization</label>
          <input
            type="text"
            placeholder="e.g. Corporate Law, Immigration"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Jurisdictions</label>
          <input
            type="text"
            placeholder="e.g. Ghana, Nigeria, ECOWAS"
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      <button
        type="submit"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Save Profile
      </button>
    </form>
  );
}
