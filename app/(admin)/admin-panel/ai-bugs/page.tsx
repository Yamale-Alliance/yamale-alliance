import { redirect } from "next/navigation";

export default function AdminAiBugsListRedirect() {
  redirect("/admin-panel/ai-quality?tab=bugs");
}
