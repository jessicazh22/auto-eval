import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ScoreBadge from "@/components/shared/ScoreBadge";
import StatusBadge from "@/components/shared/StatusBadge";
import ResultRow from "@/components/run/ResultRow";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingDown, Sparkles, Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const STRATEGY_LABELS = { rule: "Rule", example: "Example", restructure: "Restructure" };
const STRATEGY_COLORS = {
  rule: "bg-blue-100 text-blue-800 border-blue-200",
  example: "bg-purple-100 text-purple-800 border-purple-200",
  restructure: "bg-orange-100 text-orange-800 border-orange-200",
};

export default function EvalRunDetail() {
  const runId = window.location.pathname.split("/run/")[1];
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [improving, setImproving] = useState(false);
  const [approvingId, setApprovingId] = useState(null);

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

  const { data: variant } = useQuery({
    queryKey: ["variant-for-run", runId],
    queryFn: async () => {
      const vars = await base44.entities.PromptVariant.filter({ variant_eval_run_id: runId });
      return vars[0] || null;
    },
    enabled: !!runId,
  });

  const { data: parentRun } = useQuery({
    queryKey: ["parent-run", variant?.parent_eval_run_id, run?.prompt_id],
    queryFn: async () => {
      if (variant?.parent_eval_run_id) {
        const runs = await base44.entities.EvalRun.filter({ id: variant.parent_eval_run_id });
        return runs[0] || null;
      }
      if (run?.prompt_id) {
        const allRuns = await base44.entities.EvalRun.filter({ prompt_id: run.prompt_id });
        const sorted = allRuns.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        const currentIndex = sorted.findIndex(r => r.id === runId);
        return currentIndex > 0 ? sorted[currentIndex + 1] : null;
      }
      return null;
    },
    enabled: !!run?.prompt_id,
  });

  // Pending approval variants for this run (shown inline after clicking Improve Prompt)
  const { data: pendingVariants = [], refetch: refetchPending } = useQuery({
    queryKey: ["pending-variants", runId],
    queryFn: async () => {
      const vars = await base44.entities.PromptVariant.filter({ parent_eval_run_id: runId });
      return vars.filter(v => v.status === "pending_approval");
    },
    enabled: !!runId,
    refetchInterval: improving ? 2000 : false,
  });

  // Poll while run is in progress
  const isRunning = run?.status === "running" || run?.status === "pending";
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["run", runId] });
      queryClient.invalidateQueries({ queryKey: ["run-results", runId] });
    }, 3000);
    return () => clearInterval(interval);
  }, [isRunning, runId, queryClient]);

  // Stop polling for pending variants once they arrive
  useEffect(() => {
    if (pendingVariants.length > 0) setImproving(false);
  }, [pendingVariants.length]);

  async function handleImprovePrompt() {
    setImproving(true);
    try {
      await base44.functions.invoke("improvePrompt", { eval_run_id: runId, annotations: [] });
      // Kick off first check — refetchInterval keeps polling every 2s while improving=true
      refetchPending();
      // Success: improving stays true until useEffect above detects pendingVariants arriving
    } catch (err) {
      console.error("improvePrompt failed:", err);
      setImproving(false);
      alert("Variant generation failed — please try again.");
    }
  }

  async function handleApprove(variantId) {
    setApprovingId(variantId);
    await base44.functions.invoke("improvePrompt", { approve_variant_id: variantId });
    queryClient.invalidateQueries({ queryKey: ["pending-variants", runId] });
    setApprovingId(null);
    navigate(`/experiments`);
  }

  async function handleDiscard(variantId) {
    await base44.entities.PromptVariant.update(variantId, { status: "rejected" });
    queryClient.invalidateQueries({ queryKey: ["pending-variants", runId] });
  }

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

  const hasPendingVariants = pendingVariants.length > 0;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Top bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-xl font-semibold">{prompt?.name || "Eval Run"}</h1>
        <StatusBadge status={run.status} />
        <span className="text-sm text-muted-foreground">
          {new Date(run.created_date).toLocaleString("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })} AEST
        </span>
        {run.status === "complete" && !hasPendingVariants && (
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={improving}
              onClick={handleImprovePrompt}
              className="gap-1.5"
            >
              {improving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {improving ? "Generating variants…" : "Improve Prompt"}
            </Button>
            <button
              onClick={() => navigate(`/experiments`)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              View all experiments →
            </button>
          </div>
        )}
      </div>

      {/* Score summary */}
      {run.status === "complete" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Composite Score</p>
            <p className="text-3xl font-semibold tabular-nums">
              {(run.overall_score / 10).toFixed(4)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{run.overall_score?.toFixed(1)} / 100</p>
          </div>

          {run.weakest_criterion && (
            <div className="border border-amber-200 rounded-lg p-4 bg-amber-50 col-span-1 sm:col-span-2">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
                <p className="text-xs font-medium text-amber-700 uppercase tracking-wider">Weakest Criterion</p>
              </div>
              <p className="text-lg font-semibold text-amber-900">{run.weakest_criterion}</p>
              <p className="text-xs text-amber-700 mt-0.5">
                avg {run.weakest_criterion_score?.toFixed(1)} / 10 across {run.test_inputs_count} doc{run.test_inputs_count !== 1 ? "s" : ""}
              </p>
              {run.criterion_averages && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(run.criterion_averages).sort((a, b) => a[1] - b[1]).map(([name, score]) => (
                    <span
                      key={name}
                      className={`text-xs px-2 py-0.5 rounded-full border ${name === run.weakest_criterion ? "bg-amber-200 border-amber-300 text-amber-900 font-medium" : "bg-white border-border text-muted-foreground"}`}
                    >
                      {name}: {score.toFixed(1)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isRunning && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
          Running evaluation...
        </div>
      )}

      {/* Pending approval panel */}
      {hasPendingVariants && (
        <div className="border-2 border-primary/20 rounded-xl bg-primary/5 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">3 variants ready — pick one to run full eval</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {pendingVariants.map(v => (
              <VariantApprovalCard
                key={v.id}
                variant={v}
                onApprove={() => handleApprove(v.id)}
                onDiscard={() => handleDiscard(v.id)}
                approving={approvingId === v.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Comparison with parent run */}
      {parentRun && run.status === "complete" && (
        <div className="border rounded-lg p-4 bg-card space-y-4">
          <h2 className="text-sm font-semibold">
            Criterion Comparison
            <button
              onClick={() => navigate(`/run/${parentRun.id}`)}
              className="text-xs font-normal text-primary hover:underline ml-2"
            >
              vs {new Date(parentRun.created_date).toLocaleString("en-AU", { timeZone: "Australia/Sydney", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
            </button>
          </h2>
          <div className="grid grid-cols-2 gap-4 text-xs">
            {Object.entries(run.criterion_averages || {}).map(([criterion, score]) => {
              const parentScore = parentRun.criterion_averages?.[criterion] || 0;
              const delta = score - parentScore;
              return (
                <div key={criterion} className="border rounded p-3 space-y-1">
                  <p className="font-medium text-foreground">{criterion}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{parentScore.toFixed(1)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className={delta > 0 ? "text-green-600 font-semibold" : delta < 0 ? "text-red-600 font-semibold" : ""}>{score.toFixed(1)}</span>
                    {delta !== 0 && (
                      <span className={`text-xs ${delta > 0 ? "text-green-600" : "text-red-600"}`}>
                        ({delta > 0 ? "+" : ""}{delta.toFixed(1)})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {variant && (
            <div className="border-t pt-3 space-y-3">
              {variant.diagnosis && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Diagnosis</p>
                  <p className="text-sm leading-relaxed text-foreground">{variant.diagnosis}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Experiment Hypothesis</p>
                <p className="text-sm font-medium leading-relaxed">{variant.change_summary}</p>
                {variant.target_criterion && (
                  <p className="text-xs text-muted-foreground">Targeting: {variant.target_criterion}</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Result: {variant.score_delta > 0 ? "✓ Improved" : variant.score_delta < 0 ? "✗ Declined" : "— No change"} ({variant.score_delta > 0 ? "+" : ""}{variant.score_delta?.toFixed(1)})
              </p>
            </div>
          )}
        </div>
      )}

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

function VariantApprovalCard({ variant, onApprove, onDiscard, approving }) {
  const [showSample, setShowSample] = useState(false);
  const strategyKey = variant.strategy || "rule";
  const strategyLabel = STRATEGY_LABELS[strategyKey] || strategyKey;
  const strategyColor = STRATEGY_COLORS[strategyKey] || STRATEGY_COLORS.rule;

  return (
    <div className="border rounded-lg bg-white flex flex-col">
      <div className="p-4 space-y-3 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${strategyColor}`}>
            {strategyLabel}
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">What changed</p>
          <p className="text-sm leading-relaxed">{variant.change_summary}</p>
        </div>

        {variant.why_this_helps && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Why it should help</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{variant.why_this_helps}</p>
          </div>
        )}

        {variant.sample_output && (
          <div className="space-y-1">
            <button
              onClick={() => setShowSample(s => !s)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {showSample ? "Hide sample output ↑" : "Show sample output ↓"}
            </button>
            {showSample && (
              <div className="bg-muted rounded p-2 text-xs text-muted-foreground leading-relaxed max-h-40 overflow-y-auto">
                {variant.sample_output}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t p-3 flex gap-2">
        <Button
          size="sm"
          className="flex-1 gap-1.5"
          onClick={onApprove}
          disabled={approving}
        >
          {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
          {approving ? "Starting…" : "Approve"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-muted-foreground"
          onClick={onDiscard}
          disabled={approving}
        >
          <XCircle className="w-3.5 h-3.5" />
          Discard
        </Button>
      </div>
    </div>
  );
}
