import { NavLink, Outlet } from "react-router-dom";
import { Hash, Image, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";

const nav = [
  { to: "/favicon", label: "Favicon", icon: Image },
  { to: "/gravatar", label: "Gravatar", icon: UserCircle2 },
  { to: "/hash", label: "Hash", icon: Hash },
];

export function AppShell() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between gap-6">
          <NavLink to="/" className="font-semibold text-lg tracking-tight">
            Jig
          </NavLink>
          <nav className="flex items-center gap-1">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <Outlet />
        </div>
      </main>
      <footer className="border-t bg-card">
        <div className="mx-auto max-w-5xl px-4 py-3 text-xs text-muted-foreground">
          Jig v{__APP_VERSION__} · client-side tools, runs entirely in your
          browser
        </div>
      </footer>
    </div>
  );
}
