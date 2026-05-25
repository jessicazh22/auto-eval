import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, Minus, Loader2, Plus } from "lucide-react";
import ScoreBadge from "@/components/shared/ScoreBadge";
import CollapsibleDiffViewer from "@/components/experiments/CollapsibleDiffViewer";
import NewExperimentModal from "@/components/experiments/NewExperimentModal";
import { Button } from "@/components/ui/button";

export default function Experiments() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ["all-variants"],
    queryFn: () => base44.entities.PromptVariant.list("-created_date"),
  });

  const { data: prompts = [] } = useQuery({
    queryKey: ["prompts"],
    queryFn: () => base44.entities.Prompt.list("-created_date"),
  });

  const promptMap = Object.fromEntries(prompts.map(p => [p.id, p]));

  const hasRunning = variants.some(v => v.status === "running" || v.status === "generating");
  useEffect(() => {
    if (!hasRunning) return;
    const interval = setInterval(async () => {
      for (const v of variants) {
        if ((v.status === "running" || v.status === "generating") && v.variant_eval_run_id) {
          const runs = await base44.entities.EvalRun.filter({ id: v.variant_eval_run_id });
          const run = runs[0];
          if (run?.status === "complete") {
            const delta = (run.overall_score || 0) - (v.original_score || 0);
            await base44.entities.PromptVariant.update(v.id, {
              variant_score: run.overall_score,
              score_delta: Math.round(delta * 10) / 10,
              status: "complete",
            });
          } else if (run?.status === "failed") {
            await base44.entities.PromptVariant.update(v.id, { status: "failed" });
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ["all-variants"] });
    }, 4000);
    return () => clearInterval(interval);
  }, [hasRunning, variants, queryClient]);

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
            />
          );
        })}
      </div>
    </div>
  );
}

function VariantCard({ variant, promptName, onViewPrompt, onViewRun, onApplied }) {
  const delta = variant.score_delta;
  const isRunning = variant.status === "running" || variant.status === "generating";

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="px-5 py-4 flex items-start justify-between gap-4 border-b border-border">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {promptName && (
              <button onClick={onViewPrompt} className="text-xs font-medium text-primary hover:underline">
                {promptName}
              </button>
            )}
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              {variant.source === "annotations" ? "From Annotations" : "A/B Tweak"}
            </span>
            {variant.target_criterion && (
              <span className="text-xs text-muted-foreground">
                targeting <span className="font-medium text-foreground">{variant.target_criterion}</span>
              </span>
            )}
          </div>
          <p className="text-sm font-medium">{variant.change_summary}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(variant.created_date).toLocaleString("en-AU", {
              timeZone: "Australia/Sydney",
              month: "short", day: "numeric",
              hour: "numeric", minute: "2-digit", hour12: true
            })}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isRunning ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Scoring…
            </div>
          ) : variant.status === "complete" ? (
            <>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Before → After</p>
                <div className="flex items-center gap-2">
                  <ScoreBadge score={variant.original_score} size="sm" />
                  <span className="text-muted-foreground">→</span>
                  <ScoreBadge score={variant.variant_score || 0} size="sm" />
                  <DeltaBadge delta={delta} />
                </div>
              </div>
              {variant.variant_eval_run_id && (
                <Button size="sm" variant="outline" onClick={onViewRun} className="text-xs">
                  View results
                </Button>
              )}
            </>
          ) : variant.status === "failed" ? (
            <span className="text-xs text-destructive">Failed</span>
          ) : null}
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

function DeltaBadge({ delta }) {
  if (delta == null) return null;
  if (delta > 0) return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-green-600">
      <TrendingUp className="w-3.5 h-3.5" />+{delta.toFixed(1)}
    </span>
  );
  if (delta < 0) return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-red-500">
      <TrendingDown className="w-3.5 h-3.5" />{delta.toFixed(1)}
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-muted-foreground">
      <Minus className="w-3 h-3" />0
    </span>
  );
}