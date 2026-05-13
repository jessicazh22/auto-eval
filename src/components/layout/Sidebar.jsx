import { Link, useLocation } from "react-router-dom";
import { FlaskConical, FileText, Sparkles } from "lucide-react";

export default function Sidebar() {
  const location = useLocation();
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div className="w-60 h-screen bg-sidebar text-sidebar-foreground flex flex-col fixed left-0 top-0 z-30">
      <div className="p-5 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2.5">
          <FlaskConical className="w-5 h-5 text-sidebar-primary" />
          <span className="text-lg font-semibold text-sidebar-primary tracking-tight">EvalLoop</span>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        <Link
          to="/"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
            isActive("/") && !location.pathname.startsWith("/prompt") && !location.pathname.startsWith("/run")
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
          }`}
        >
          <FileText className="w-4 h-4" />
          Prompts
        </Link>
        <Link
          to="/generate-rubric"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
            isActive("/generate-rubric")
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Generate Rubric
        </Link>
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/50">EvalLoop v1</p>
      </div>
    </div>
  );
}