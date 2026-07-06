"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Profile } from "@/lib/database.types";
import { can, type Permission } from "@/lib/permissions";

const ProfileContext = createContext<Profile | null>(null);

export function ProfileProvider({
  profile,
  children,
}: {
  profile: Profile;
  children: ReactNode;
}) {
  return (
    <ProfileContext.Provider value={profile}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): Profile {
  const profile = useContext(ProfileContext);
  if (!profile) throw new Error("useProfile must be used inside the app shell");
  return profile;
}

export function useCan() {
  const profile = useProfile();
  return (action: Permission) => can(profile.role, action);
}
