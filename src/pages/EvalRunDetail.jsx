import { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ScoreBadge from "@/components/shared/ScoreBadge";
import StatusBadge from "@/components/shared/StatusBadge";
import ResultRow from "@/components/run/ResultRow";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";

export default function EvalRunDetail() {
  const runId = window.location.pathname.split("/run/")[1];
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: run, isLoading } = useQuery({
    queryKey: ["run", runId],
    queryFn: async () => {
      const runs = await base44.entities.EvalRun.filter({ id: runId });
      return runs[0] || null;
    },
    enabled: !!runId,
  });

  const { data: prompt } = useQuery({
    queryKey: ["run-prompt", run?.prompt_id],
    queryFn: async () => {
      const prompts = await base44.entities.Prompt.filter({ id: run.prompt_id });
      return prompts[0] || null;
    },
    enabled: !!run?.prompt_id,
  });

  const { data: results } = useQuery({
    queryKey: ["run-results", runId],
    queryFn: () => base44.entities.EvalResult.filter({ eval_run_id: runId }),
    enabled: !!runId,
    initialData: [],
  });

  // Poll while running
  const isRunning = run?.status === "running" || run?.status === "pending";
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["run", runId] });
      queryClient.invalidateQueries({ queryKey: ["run-results", runId] });
    }, 3000);
    return () => clearInterval(interval);
  }, [isRunning, runId, queryClient]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Run not found.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <button
        onClick={() => navigate(prompt ? `/prompt/${prompt.id}` : "/")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {prompt?.name || "prompts"}
      </button>

      {/* Top bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-xl font-semibold">{prompt?.name || "Eval Run"}</h1>
        <StatusBadge status={run.status} />
        <ScoreBadge score={run.status === "complete" ? run.overall_score : null} size="lg" />
        <span className="text-sm text-muted-foreground ml-auto">
          {format(new Date(run.created_date), "MMM d, yyyy h:mm a")}
        </span>
      </div>

      {/* Results table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Input</TableHead>
              <TableHead>Output</TableHead>
              <TableHead className="w-24">Score</TableHead>
              <TableHead className="w-12">Flag</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((result, i) => (
              <ResultRow key={result.id} result={result} index={i} />
            ))}
            {results.length === 0 && (
              <TableRow>
                <td colSpan={5} className="text-sm text-muted-foreground text-center py-8">
                  {isRunning ? "Processing test inputs..." : "No results."}
                </td>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}