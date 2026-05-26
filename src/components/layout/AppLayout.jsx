import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f5f5f5]">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <main
        className="flex-1 overflow-y-auto transition-all duration-300"
        style={{ marginLeft: collapsed ? 60 : 260 }}
      >
        <Outlet />
      </main>
    </div>
  );
}
