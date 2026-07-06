"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile, useCan } from "@/components/profile-context";
import { ROLE_LABELS } from "@/lib/permissions";
import { NAV_SECTIONS } from "@/components/nav-config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Building2, LogOut } from "lucide-react";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useProfile();
  const canDo = useCan();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r bg-sidebar md:flex">
      <div className="flex items-center gap-3 border-b px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Building2 className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="font-heading text-lg font-medium leading-tight">Lazim</p>
          <p className="text-xs text-muted-foreground">
            Apartment Management System
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {NAV_SECTIONS.map((section) => {
          const visible = section.items.filter((i) => canDo(i.permission));
          if (visible.length === 0) return null;
          return (
            <div key={section.title}>
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
              <ul className="space-y-1">
                {visible.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-foreground/80 hover:bg-sidebar-accent hover:text-foreground"
                        )}
                      >
                        <item.icon className="h-5 w-5 shrink-0" aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <div className="mb-3 px-1">
          <p className="truncate font-medium">{profile.full_name || profile.email}</p>
          <p className="text-sm text-muted-foreground">
            {ROLE_LABELS[profile.role]}
          </p>
        </div>
        <Button
          variant="outline"
          className="h-11 w-full justify-start gap-2 text-[15px]"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
