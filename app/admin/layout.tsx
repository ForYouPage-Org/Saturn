"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiPath } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/participants", label: "Participants" },
  { href: "/admin/surveys", label: "Surveys" },
  { href: "/admin/events", label: "Activity" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [via, setVia] = useState<"token" | "sso" | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const onLogin = pathname?.endsWith("/admin/login") ?? false;

  useEffect(() => {
    fetch(apiPath("/api/admin/me"), { credentials: "same-origin" })
      .then((r) => r.json())
      .then(
        (data: {
          authenticated: boolean;
          via: "token" | "sso" | null;
          email: string | null;
        }) => {
          setAuthed(data.authenticated);
          setVia(data.via);
          setEmail(data.email);
          if (!data.authenticated && !onLogin) router.replace("/admin/login");
          // If on /admin/login but already authed (e.g. via SSO), skip the form.
          if (data.authenticated && onLogin) router.replace("/admin");
        }
      )
      .catch(() => setAuthed(false));
  }, [onLogin, router]);

  async function signOut() {
    if (via === "sso") {
      // SSO came from the hub — sign out there to drop the hub session
      // (and by extension the pilot's view of admin-ness).
      window.location.href = "/api/auth/logout";
      return;
    }
    await fetch(apiPath("/api/admin/logout"), {
      method: "POST",
      credentials: "same-origin",
    });
    router.replace("/admin/login");
  }

  if (onLogin) return <>{children}</>;
  if (authed === null) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
      </main>
    );
  }
  if (!authed) return null;

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="hidden min-h-screen w-56 shrink-0 flex-col border-r border-neutral-200 bg-white p-4 md:flex">
        <div className="mb-6 px-2 text-sm font-semibold">Mercury · Admin</div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const active =
              n.href === "/admin"
                ? pathname === "/admin"
                : pathname?.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm",
                  active
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-700 hover:bg-neutral-100"
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto pt-4 text-xs text-neutral-500">
          {via === "sso" && email && (
            <div className="px-3 pb-2 leading-tight">
              <div className="text-[10px] uppercase tracking-wider text-neutral-400">
                via hub SSO
              </div>
              <div className="truncate font-mono text-neutral-700">{email}</div>
            </div>
          )}
          <button
            type="button"
            onClick={signOut}
            className="rounded-md px-3 py-2 hover:bg-neutral-100"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto">
        <div className="border-b border-neutral-200 bg-white px-6 py-3 md:hidden">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Mercury · Admin</span>
            <button onClick={signOut} className="text-xs text-neutral-500">
              Sign out
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "rounded-md px-2 py-1",
                  (n.href === "/admin"
                    ? pathname === "/admin"
                    : pathname?.startsWith(n.href))
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-700"
                )}
              >
                {n.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
