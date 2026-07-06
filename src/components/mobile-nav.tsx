"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile, useCan } from "@/components/profile-context";
import { ROLE_LABELS } from "@/lib/permissions";
import { NAV_SECTIONS } from "@/components/nav-config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Building2, LogOut, Menu } from "lucide-react";

/**
 * Top bar shown only on phones/small screens (the sidebar takes over
 * from `md:` upward). The hamburger opens a slide-in menu with the
 * same items as the desktop sidebar.
 */
export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useProfile();
  const canDo = useCan();
  const [open, setOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-sidebar px-4 py-3 md:hidden">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="h-4 w-4" aria-hidden />
        </div>
        <p className="font-heading text-lg font-medium">Lazim</p>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              aria-label="Open menu"
            />
          }
        >
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetHeader className="border-b px-5 py-4 text-left">
            <SheetTitle className="font-heading text-lg">Menu</SheetTitle>
            <p className="text-sm text-muted-foreground">
              {profile.full_name || profile.email} · {ROLE_LABELS[profile.role]}
            </p>
          </SheetHeader>

          <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
            {NAV_SECTIONS.map((section) => {
              const visible = section.items.filter((i) => canDo(i.permission));
              if (visible.length === 0) return null;
              return (
                <div key={section.title}>
                  <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors",
                              active
                                ? "bg-primary text-primary-foreground"
                                : "text-foreground/80 hover:bg-sidebar-accent"
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
            <Button
              variant="outline"
              className="h-11 w-full justify-start gap-2 text-base"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
