import { useEffect } from "react";
import { base44 } from "@/api/base44Client";

export function useVariantPolling(variants, queryClient, queryKey) {
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

            // Compute per-criterion deltas by fetching parent run's criterion averages
            let per_criterion_delta = {};
            try {
              if (v.parent_eval_run_id && run.criterion_averages) {
                const parentRuns = await base44.entities.EvalRun.filter({ id: v.parent_eval_run_id });
                const parentRun = parentRuns[0];
                if (parentRun?.criterion_averages) {
                  for (const [criterion, variantScore] of Object.entries(run.criterion_averages)) {
                    const parentScore = parentRun.criterion_averages[criterion] ?? 0;
                    per_criterion_delta[criterion] = Math.round((variantScore - parentScore) * 10) / 10;
                  }
                }
              }
            } catch (_) { /* non-critical */ }

            await base44.entities.PromptVariant.update(v.id, {
              variant_score: run.overall_score,
              score_delta: Math.round(delta * 10) / 10,
              per_criterion_delta,
              status: "complete",
            });
          } else if (run?.status === "failed") {
            await base44.entities.PromptVariant.update(v.id, { status: "failed" });
          }
        }
      }
      queryClient.invalidateQueries({ queryKey });
    }, 4000);
    return () => clearInterval(interval);
  }, [hasRunning, variants, queryClient, queryKey]);
}
