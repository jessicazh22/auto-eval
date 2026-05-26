import { Link, useLocation } from "react-router-dom";
import { FileText, Sparkles, BarChart2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

const workspaces = [
  { name: "Product Team", color: "#a8c8e8" },
  { name: "Marketing Lab", color: "#e8b8c4" },
];

export default function Sidebar({ collapsed, onToggle }) {
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
    <div
      className="h-screen fixed left-0 top-0 z-30 flex flex-col border-r border-[#e7e5e4] bg-[#f5f5f5]/80 backdrop-blur-sm transition-all duration-300 overflow-hidden"
      style={{ width: collapsed ? 60 : 260 }}
    >
      {/* Logo + toggle */}
      <div className="px-4 py-6 flex items-center justify-between flex-shrink-0">
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#0c0a09] rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <span className="text-[17px] font-medium tracking-tight text-[#0c0a09] whitespace-nowrap">EvalLoop</span>
          </Link>
        )}
        {collapsed && (
          <Link to="/" className="mx-auto">
            <div className="w-8 h-8 bg-[#0c0a09] rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          </Link>
        )}
        {!collapsed && (
          <button onClick={onToggle} className="text-[#a8a29e] hover:text-[#0c0a09] transition-colors flex-shrink-0">
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1 overflow-hidden">
        <NavItem to="/" active={isActive("/") && !location.pathname.startsWith("/prompt") && !location.pathname.startsWith("/run")} icon={<FileText className="w-5 h-5 flex-shrink-0" />} label="Prompts" collapsed={collapsed} />
        <NavItem to="/generate-rubric" active={isActive("/generate-rubric")} icon={<Sparkles className="w-5 h-5 flex-shrink-0" />} label="Generate Rubric" collapsed={collapsed} />
        <NavItem to="/experiments" active={isActive("/experiments")} icon={<BarChart2 className="w-5 h-5 flex-shrink-0" />} label="Experiments" collapsed={collapsed} />

        {!collapsed && (
          <>
            <div className="pt-8 pb-2 px-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#a8a29e]">Workspace</p>
            </div>
            {workspaces.map((ws) => (
              <div
                key={ws.name}
                className="flex items-center gap-3 px-4 py-2 text-[#777169] hover:text-[#0c0a09] rounded-full text-[15px] transition-all cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ws.color }} />
                {ws.name}
              </div>
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-[#e7e5e4] flex-shrink-0">
        {collapsed ? (
          <div className="flex justify-center">
            <button onClick={onToggle} className="text-[#a8a29e] hover:text-[#0c0a09] transition-colors">
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#f0efed] border border-[#e7e5e4] flex items-center justify-center text-[13px] font-medium text-[#292524] flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-[#0c0a09] leading-tight truncate">{user?.full_name || "User"}</p>
              <p className="text-[12px] text-[#777169]">Pro Plan</p>
            </div>
            <button className="text-[#a8a29e] hover:text-[#0c0a09] transition-colors flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NavItem({ to, active, icon, label, collapsed }) {
  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-full text-[15px] font-medium transition-all ${
        active
          ? "bg-[#f0efed] text-[#0c0a09]"
          : "text-[#777169] hover:text-[#0c0a09] hover:bg-[#f0efed]/60"
      } ${collapsed ? "justify-center px-0" : ""}`}
    >
      {icon}
      {!collapsed && <span className="whitespace-nowrap">{label}</span>}
    </Link>
  );
}
