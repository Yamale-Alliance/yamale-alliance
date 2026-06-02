"use client";

import { UserProfile } from "@clerk/nextjs";
import { yamaleUserProfileAppearance } from "@/lib/clerk-appearance";

const PROFILE_PATH = "/account/profile";

/** Full Clerk profile UI: Profile + Security (password, devices, delete account). */
export function AccountUserProfile() {
  return (
    <div className="yamale-user-profile mt-6 w-full min-w-0">
      <UserProfile routing="path" path={PROFILE_PATH} appearance={yamaleUserProfileAppearance}>
        <UserProfile.Page label="account" />
        <UserProfile.Page label="security" />
      </UserProfile>
    </div>
  );
}
