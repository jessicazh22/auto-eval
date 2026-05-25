import { Link, useLocation } from "react-router-dom";
import { FileText, Sparkles, BarChart2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

const workspaces = [
  { name: "Product Team", color: "#a78bfa" },
  { name: "Marketing Lab", color: "#f87171" },
];

export default function Sidebar() {
  const location = useLocation();
  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="w-56 h-screen bg-white text-foreground flex flex-col fixed left-0 top-0 z-30 border-r border-border">
      {/* Logo */}
      <div className="px-5 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-foreground rounded-md flex items-center justify-center">
            <span className="text-background text-xs font-bold">EL</span>
          </div>
          <span className="text-base font-semibold tracking-tight">EvalLoop</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        <NavItem to="/" active={isActive("/") && !location.pathname.startsWith("/prompt") && !location.pathname.startsWith("/run")} icon={<FileText className="w-4 h-4" />} label="Prompts" />
        <NavItem to="/generate-rubric" active={isActive("/generate-rubric")} icon={<Sparkles className="w-4 h-4" />} label="Generate Rubric" />
        <NavItem to="/experiments" active={isActive("/experiments")} icon={<BarChart2 className="w-4 h-4" />} label="Experiments" />

        {/* Workspace section */}
        <div className="pt-5 pb-1 px-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Workspace</p>
        </div>
        {workspaces.map((ws) => (
          <div
            key={ws.name}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ws.color }} />
            {ws.name}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{user?.full_name || "User"}</p>
              <p className="text-[10px] text-muted-foreground truncate">Pro Plan</p>
            </div>
          </div>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function NavItem({ to, active, icon, label }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${
        active
          ? "bg-secondary text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}