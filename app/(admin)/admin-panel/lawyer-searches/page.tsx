import { redirect } from "next/navigation";

export default function AdminLawyerSearchesRedirectPage() {
  redirect("/admin-panel/revenue?tab=lawyer_searches");
}
