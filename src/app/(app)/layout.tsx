import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { ProfileProvider } from "@/components/profile-context";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();

  if (!profile) redirect("/login");
  if (!profile.is_active) redirect("/login?deactivated=1");

  return (
    <ProfileProvider profile={profile}>
      <div className="min-h-screen bg-background">
        {/* Phone-only top bar with hamburger menu */}
        <MobileNav />
        <div className="flex">
          {/* Desktop-only sidebar */}
          <AppSidebar />
          <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </ProfileProvider>
  );
}
