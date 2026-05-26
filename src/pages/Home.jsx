import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { format } from "date-fns";

const DOT_COLORS = ["#a7e5d3", "#f4c5a8", "#c8b8e0", "#a8c8e8", "#e8b8c4"];

export default function Home() {
  const navigate = useNavigate();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");

  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ["prompts"],
    queryFn: () => base44.entities.Prompt.list("-created_date"),
    initialData: [],
  });

  const { data: runs = [] } = useQuery({
    queryKey: ["all-runs"],
    queryFn: () => base44.entities.EvalRun.list("-created_date"),
    initialData: [],
  });

  const getLastRun = (promptId) => {
    const promptRuns = runs
      .filter((r) => r.prompt_id === promptId && r.status === "complete")
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    return promptRuns[0] || null;
  };

  const scores = prompts
    .map((p) => getLastRun(p.id)?.overall_score)
    .filter((s) => s != null);
  const avgScore = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const prompt = await base44.entities.Prompt.create({
      name: newName.trim(),
      prompt_text: "",
    });
    await base44.entities.Rubric.create({
      prompt_id: prompt.id,
      passing_threshold: 70,
    });
    setCreating(false);
    setShowNew(false);
    setNewName("");
    navigate(`/prompt/${prompt.id}`);
  };

  return (
    <div className="px-12 py-16 max-w-[1200px] mx-auto">

      {/* Header */}
      <header className="flex justify-between items-end mb-14">
        <div>
          <p className="text-[12px] uppercase font-bold text-[#a8a29e] tracking-[0.1em] mb-2">
            Prompt Inventory
          </p>
          <h1
            className="text-[48px] text-[#0c0a09] leading-[1.08] tracking-tight"
            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}
          >
            Your active evaluations
          </h1>
        </div>
        <div className="flex gap-3">
          <button className="px-5 py-2.5 text-[#0c0a09] border border-[#d6d3d1] rounded-full text-[15px] font-medium hover:bg-white transition-all">
            Search...
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="px-6 py-2.5 bg-[#292524] text-white rounded-full text-[15px] font-medium hover:bg-[#0c0a09] transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Prompt
          </button>
        </div>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-6 mb-10">
        <div className="bg-white border border-[#e7e5e4] rounded-[16px] p-6 hover:shadow-sm transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-[#f0efed] rounded-full flex items-center justify-center text-[#292524]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-[12px] text-[#16a34a] bg-[#16a34a]/10 px-2 py-0.5 rounded-full font-medium">Stable</span>
          </div>
          <p className="text-[14px] text-[#777169] mb-1">Average Quality Score</p>
          <p className="text-[32px] text-[#0c0a09]" style={{ fontFamily: "'EB Garamond', serif" }}>
            {avgScore != null ? avgScore : "—"}
            <span className="text-[18px] text-[#a8a29e] ml-1">/100</span>
          </p>
        </div>

        <div className="bg-white border border-[#e7e5e4] rounded-[16px] p-6 hover:shadow-sm transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-[#f0efed] rounded-full flex items-center justify-center text-[#292524]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <p className="text-[14px] text-[#777169] mb-1">Evaluations Run</p>
          <p className="text-[32px] text-[#0c0a09]" style={{ fontFamily: "'EB Garamond', serif" }}>
            {runs.length.toLocaleString()}
          </p>
        </div>

        <div className="bg-white border border-[#e7e5e4] rounded-[16px] p-6 hover:shadow-sm transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-[#f0efed] rounded-full flex items-center justify-center text-[#292524]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-[14px] text-[#777169] mb-1">Token Usage Efficiency</p>
          <p className="text-[32px] text-[#0c0a09]" style={{ fontFamily: "'EB Garamond', serif" }}>
            94.1<span className="text-[18px] text-[#a8a29e] ml-1">%</span>
          </p>
        </div>
      </div>

      {/* Recent Projects table */}
      <div className="bg-white border border-[#e7e5e4] rounded-[16px] mb-12 overflow-hidden">
        <div className="px-8 py-5 border-b border-[#f0efed] flex items-center justify-between">
          <h3 className="text-[24px] text-[#0c0a09]" style={{ fontFamily: "'EB Garamond', serif" }}>
            Recent Projects
          </h3>
          <div className="flex gap-1">
            {["All", "Production", "Draft"].map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1.5 text-[13px] font-medium rounded-full transition-all ${
                  activeFilter === f
                    ? "bg-[#f0efed] text-[#0c0a09]"
                    : "text-[#777169] hover:text-[#0c0a09]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#e7e5e4] border-t-[#292524] rounded-full animate-spin" />
          </div>
        ) : prompts.length === 0 ? (
          <div className="text-center py-16 text-[#a8a29e] text-[15px]">
            No prompts yet. Create your first one.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-[12px] uppercase tracking-[0.08em] text-[#a8a29e] font-bold border-b border-[#f0efed]">
                <th className="px-8 py-4 font-semibold">Prompt Name</th>
                <th className="px-8 py-4 font-semibold">Version</th>
                <th className="px-8 py-4 font-semibold">Last Score</th>
                <th className="px-8 py-4 font-semibold">Last Run</th>
                <th className="px-8 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-[#292524] text-[15px]">
              {prompts.map((prompt, i) => {
                const lastRun = getLastRun(prompt.id);
                const score = lastRun?.overall_score ?? null;
                const isLow = score != null && score < 70;
                return (
                  <tr
                    key={prompt.id}
                    className="border-b border-[#f0efed] last:border-0 hover:bg-[#fafafa] transition-all group cursor-pointer"
                    onClick={() => navigate(`/prompt/${prompt.id}`)}
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: DOT_COLORS[i % DOT_COLORS.length] }} />
                        <span className="font-medium">{prompt.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-[#777169]">—</td>
                    <td className="px-8 py-5">
                      {score != null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-[#f0efed] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${score}%`,
                                backgroundColor: isLow ? "#dc2626" : "#292524",
                              }}
                            />
                          </div>
                          <span className={`font-medium ${isLow ? "text-[#dc2626]" : ""}`}>{score}</span>
                        </div>
                      ) : (
                        <span className="text-[#a8a29e]">—</span>
                      )}
                    </td>
                    <td className="px-8 py-5 text-[#777169]">
                      {lastRun ? format(new Date(lastRun.created_date), "MMM d, yyyy") : "Never"}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button
                        className="text-[13px] font-medium px-4 py-1.5 rounded-full border border-[#e7e5e4] opacity-0 group-hover:opacity-100 transition-all"
                        onClick={(e) => { e.stopPropagation(); navigate(`/prompt/${prompt.id}`); }}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom 2-col section */}
      <div className="grid grid-cols-2 gap-8 mb-14">
        {/* Promo card */}
        <div className="p-10 bg-[#fafafa] rounded-[24px] relative overflow-hidden flex flex-col justify-center min-h-[280px] border border-[#e7e5e4]">
          <p className="text-[12px] uppercase font-bold text-[#777169] tracking-[0.1em] mb-4">New Feature</p>
          <h2 className="text-[32px] text-[#0c0a09] leading-[1.17] mb-5" style={{ fontFamily: "'EB Garamond', serif" }}>
            Automated Rubric Generation
          </h2>
          <p className="text-[#4e4e4e] max-w-sm mb-7 text-[15px] leading-relaxed">
            Let AI define your quality criteria. We analyze your gold-standard outputs to build precise evaluation rules in seconds.
          </p>
          <div>
            <Link
              to="/generate-rubric"
              className="inline-block px-6 py-2.5 bg-[#292524] text-white rounded-full text-[15px] font-medium hover:bg-[#0c0a09] transition-all"
            >
              Try it now
            </Link>
          </div>
        </div>

        {/* Weekly drift chart */}
        <div className="bg-white border border-[#e7e5e4] rounded-[16px] p-8 flex flex-col">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-[24px] text-[#0c0a09] mb-1" style={{ fontFamily: "'EB Garamond', serif" }}>Weekly Drift Report</h3>
              <p className="text-[14px] text-[#777169]">Performance across your prompt library</p>
            </div>
          </div>
          <div className="flex-1 flex items-end justify-between gap-2 mb-4">
            {[60, 75, 90, 65, 95, 80, 85].map((h, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t-lg transition-all ${i === 4 ? "bg-[#292524]" : "bg-[#f0efed] hover:bg-[#a8c8e8]"}`}
                style={{ height: `${h}%`, minHeight: 8 }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[12px] text-[#a8a29e] font-medium">
            {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="pt-10 border-t border-[#e7e5e4]">
        <div className="flex justify-between items-center">
          <div className="flex gap-10">
            <a href="#" className="text-[14px] text-[#777169] hover:text-[#0c0a09] transition-all">Documentation</a>
            <a href="#" className="text-[14px] text-[#777169] hover:text-[#0c0a09] transition-all">API Status</a>
            <a href="#" className="text-[14px] text-[#777169] hover:text-[#0c0a09] transition-all">Security</a>
          </div>
          <p className="text-[14px] text-[#a8a29e]">© 2024 EvalLoop. Built for clarity.</p>
        </div>
      </footer>

      {/* New Prompt dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Prompt</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Prompt name"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
