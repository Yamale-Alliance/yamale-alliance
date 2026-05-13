import { redirect } from "next/navigation";

export default function AdminAiFeedbackRedirect() {
  redirect("/admin-panel/ai-quality?tab=feedback");
}
