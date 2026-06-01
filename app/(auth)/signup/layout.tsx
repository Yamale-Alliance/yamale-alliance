import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/site-seo";

export const metadata = createPageMetadata({
  title: "Sign Up",
  description:
    "Create a Yamalé client account for the African legal library, AI research, AfCFTA tools, and The Yamalé Vault.",
  path: "/signup",
});

export default function SignupLayout({ children }: { children: ReactNode }) {
  return children;
}
