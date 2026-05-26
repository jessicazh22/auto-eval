import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2, Plus, Trash2, CheckCircle } from "lucide-react";
import ScoreBadge from "@/components/shared/ScoreBadge";
import DeltaBadge from "@/components/shared/DeltaBadge";
import CollapsibleDiffViewer from "@/components/experiments/CollapsibleDiffViewer";
import NewExperimentModal from "@/components/experiments/NewExperimentModal";
import { Button } from "@/components/ui/button";
import { useVariantPolling } from "@/hooks/useVariantPolling";

export default function Experiments() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const generatingPromptName = location.state?.generating ? location.state?.promptName : null;

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ["all-variants"],
    queryFn: async () => {
      const all = await base44.entities.PromptVariant.list("-created_date");
      return all.filter(v => v.status !== "pending_approval" && v.status !== "rejected");
    },
    refetchInterval: 5000,
  });

  const { data: prompts = [] } = useQuery({
    queryKey: ["prompts"],
    queryFn: () => base44.entities.Prompt.list("-created_date"),
  });

  const promptMap = Object.fromEntries(prompts.map(p => [p.id, p]));
  useVariantPolling(variants, queryClient, ["all-variants"]);

  const hasActiveVariants = variants.some(v => v.status === "running" || v.status === "generating");
  const showGeneratingPlaceholder = !!generatingPromptName && !hasActiveVariants;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Experiments</h1>
          <p className="text-sm text-muted-foreground mt-1">All prompt improvement attempts across every prompt.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowNew(true)}>
          <Plus className="w-3.5 h-3.5" />
          New Experiment
        </Button>
      </div>

      <NewExperimentModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onStarted={() => {
          setShowNew(false);
          queryClient.invalidateQueries({ queryKey: ["all-variants"] });
        }}
      />

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && variants.length === 0 && (
        <div className="border rounded-lg p-12 text-center text-muted-foreground text-sm">
          No experiments yet. Click "Improve Prompt" on a completed eval run to start one.
        </div>
      )}

      <div className="space-y-4">
        {showGeneratingPlaceholder && (
          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="space-y-2">
                {generatingPromptName && (
                  <p className="text-xs text-muted-foreground">{generatingPromptName.length > 40 ? generatingPromptName.slice(0, 40) + "…" : generatingPromptName}</p>
                )}
                <p className="text-sm font-semibold text-muted-foreground">Generating 3 variants…</p>
                <p className="text-xs text-muted-foreground">Analysing failing outputs and crafting improvements</p>
              </div>
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground shrink-0" />
            </div>
          </div>
        )}
        {variants.map((v) => {
          const prompt = promptMap[v.prompt_id];
          return (
            <VariantCard
              key={v.id}
              variant={v}
              promptName={prompt?.name}
              onViewPrompt={() => navigate(`/prompt/${v.prompt_id}`)}
              onViewRun={() => navigate(`/run/${v.variant_eval_run_id}`)}
              onApplied={() => queryClient.invalidateQueries({ queryKey: ["all-variants"] })}
              onDeleted={() => queryClient.invalidateQueries({ queryKey: ["all-variants"] })}
            />
          );
        })}
      </div>
    </div>
  );
}

function VariantCard({ variant, promptName, onViewPrompt, onViewRun, onApplied, onDeleted }) {
  const delta = variant.score_delta;
  const isRunning = variant.status === "running" || variant.status === "generating";
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  async function handleApply() {
    if (!window.confirm("Apply this variant as the new prompt? This will update the live prompt text.")) return;
    setApplying(true);
    await base44.entities.Prompt.update(variant.prompt_id, { prompt_text: variant.improved_prompt_text });
    setApplied(true);
    setApplying(false);
    onApplied();
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (variant.variant_eval_run_id) {
        await base44.entities.EvalRun.delete(variant.variant_eval_run_id);
      }
      await base44.entities.PromptVariant.delete(variant.id);
    },
    onSuccess: () => onDeleted(),
  });

  if (showDeleteConfirm) {
    return (
      <div className="border border-destructive rounded-lg bg-destructive/5 p-4">
        <p className="text-sm font-medium mb-3">Delete this experiment?</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="px-5 py-4 flex items-start justify-between gap-4 border-b border-border">
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {promptName && (
              <button onClick={onViewPrompt} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                {promptName.length > 40 ? promptName.slice(0, 40) + "…" : promptName}
              </button>
            )}
            {variant.strategy && (
              <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-50 text-slate-600 border-slate-200 capitalize">
                {variant.strategy}
              </span>
            )}
            {variant.target_criterion && (
              <span className="text-xs text-muted-foreground">
                → <span className="font-medium text-foreground">{variant.target_criterion}</span>
              </span>
            )}
          </div>
          {variant.change_summary && (
            <p className="text-sm font-semibold leading-snug">
              {variant.strategy ? `${variant.strategy.charAt(0).toUpperCase() + variant.strategy.slice(1)} — ` : ""}
              {variant.change_summary.length > 80 ? variant.change_summary.slice(0, 80) + "…" : variant.change_summary}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {new Date(variant.created_date).toLocaleString("en-AU", {
              timeZone: "Australia/Sydney",
              month: "short", day: "numeric",
              hour: "numeric", minute: "2-digit", hour12: true
            })}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 mt-1">
          {isRunning ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Scoring…
            </div>
          ) : variant.status === "complete" ? (
            <>
              <div className="text-right space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Before → After</p>
                  <div className="flex items-center gap-2">
                    <ScoreBadge score={variant.original_score} size="sm" />
                    <span className="text-muted-foreground">→</span>
                    <ScoreBadge score={variant.variant_score} size="sm" />
                    <DeltaBadge delta={delta} />
                  </div>
                </div>
                {variant.per_criterion_delta && Object.keys(variant.per_criterion_delta).length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-end">
                    {Object.entries(variant.per_criterion_delta).map(([criterion, d]) => {
                      const isRegression = d < -1.0;
                      const isImproved = d > 0;
                      const chipClass = isRegression
                        ? "bg-red-100 text-red-700 border-red-200"
                        : isImproved
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-amber-50 text-amber-700 border-amber-200";
                      return (
                        <span key={criterion} className={`text-xs px-1.5 py-0.5 rounded border ${chipClass}`}>
                          {criterion} {d > 0 ? "+" : ""}{d.toFixed(1)}
                          {isRegression && " ⚠"}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {applied ? (
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Applied
                  </span>
                ) : (
                  <Button size="sm" onClick={handleApply} disabled={applying} className="text-xs gap-1.5">
                    {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    {applying ? "Applying…" : "Apply to Prompt"}
                  </Button>
                )}
                {variant.variant_eval_run_id && (
                  <Button size="sm" variant="outline" onClick={onViewRun} className="text-xs">
                    View results
                  </Button>
                )}
              </div>
            </>
          ) : variant.status === "failed" ? (
            <span className="text-xs text-destructive">Failed</span>
          ) : variant.status === "rejected" ? (
            <span className="text-xs text-muted-foreground italic">Discarded</span>
          ) : null}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {variant.original_prompt_text && variant.improved_prompt_text && (
        <CollapsibleDiffViewer
          originalUrl={variant.original_prompt_text}
          improvedUrl={variant.improved_prompt_text}
        />
      )}
    </div>
  );
}