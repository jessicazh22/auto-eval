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
      queryClient.invalidateQueries({ queryKey });
    }, 4000);
    return () => clearInterval(interval);
  }, [hasRunning, variants, queryClient, queryKey]);
}