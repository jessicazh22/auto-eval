import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import ScoreBadge from "@/components/shared/ScoreBadge";
import DeltaBadge from "@/components/shared/DeltaBadge";
import PromptDiffViewer from "@/components/variant/PromptDiffViewer";
import { useVariantPolling } from "@/hooks/useVariantPolling";

export default function PromptVariantDashboard() {
  const promptId = window.location.pathname.split("/variants/")[1];
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: prompt } = useQuery({
    queryKey: ["prompt", promptId],
    queryFn: async () => {
      const res = await base44.entities.Prompt.filter({ id: promptId });
      return res[0] || null;
    },
    enabled: !!promptId,
  });

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ["variants", promptId],
    queryFn: () => base44.entities.PromptVariant.filter({ prompt_id: promptId }, "-created_date"),
    enabled: !!promptId,
  });

  useVariantPolling(variants, queryClient, ["variants", promptId]);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <button
        onClick={() => navigate(prompt ? `/prompt/${prompt.id}` : "/")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {prompt?.name || "prompt"}
      </button>

      <div>
        <h1 className="text-xl font-semibold">Prompt Improvements</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Each row is one targeted change, scored against the same test inputs.
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && variants.length === 0 && (
        <div className="border rounded-lg p-12 text-center text-muted-foreground text-sm">
          No improvements yet. Run "Improve from Annotations" on an eval run to get started.
        </div>
      )}

      <div className="space-y-4">
        {variants.map((v) => (
          <VariantCard key={v.id} variant={v} onViewRun={() => navigate(`/run/${v.variant_eval_run_id}`)} />
        ))}
      </div>
    </div>
  );
}

function VariantCard({ variant, onViewRun }) {
  const delta = variant.score_delta;
  const isRunning = variant.status === "running" || variant.status === "generating";

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-4 border-b border-border">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
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

        {/* Score comparison */}
        <div className="flex items-center gap-3 shrink-0">
          {isRunning ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Scoring...
            </div>
          ) : variant.status === "complete" ? (
            <>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Before → After</p>
                <div className="flex items-center gap-2">
                  <ScoreBadge score={variant.original_score} size="sm" />
                  <span className="text-muted-foreground">→</span>
                  <ScoreBadge score={variant.variant_score} size="sm" />
                  <DeltaBadge delta={delta} />
                </div>
              </div>
              <button
                onClick={onViewRun}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                View run →
              </button>
            </>
          ) : variant.status === "failed" ? (
            <span className="text-xs text-destructive">Failed</span>
          ) : null}
        </div>
      </div>

      {/* Diff */}
      {variant.original_prompt_text && variant.improved_prompt_text && (
        <PromptDiffViewer
          originalUrl={variant.original_prompt_text}
          improvedUrl={variant.improved_prompt_text}
        />
      )}
    </div>
  );
}