import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { TableRow, TableCell } from "@/components/ui/table";
import { Table, TableBody, TableHead, TableHeader, TableRow as TRow } from "@/components/ui/table";
import ScoreBadge from "@/components/shared/ScoreBadge";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ResultRow({ result, index }) {
   const [expanded, setExpanded] = useState(false);

   const { data: scores } = useQuery({
     queryKey: ["criterion-scores", result.id],
     queryFn: () => base44.entities.CriterionScore.filter({ eval_result_id: result.id }),
     enabled: expanded,
     initialData: [],
   });

   const { data: evalRun } = useQuery({
     queryKey: ["eval-run-for-result", result.eval_run_id],
     queryFn: () => base44.entities.EvalRun.filter({ id: result.eval_run_id }),
     enabled: expanded,
     initialData: [],
   });

   const { data: variant } = useQuery({
     queryKey: ["variant-for-eval-run", result.eval_run_id],
     queryFn: async () => {
       const vars = await base44.entities.PromptVariant.filter({ variant_eval_run_id: result.eval_run_id });
       return vars[0] || null;
     },
     enabled: expanded,
   });

  const truncate = (str, len = 60) => {
    if (!str) return "—";
    return str.length > len ? str.slice(0, len) + "…" : str;
  };

  return (
    <>
      <TableRow
        className={cn(
          "cursor-pointer transition-colors",
          result.flagged && "bg-red-50/50",
          index % 2 === 1 && !result.flagged && "bg-muted/30"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="w-8">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="text-sm font-mono max-w-[240px]">
          {truncate(result.test_input)}
        </TableCell>
        <TableCell className="text-sm max-w-[240px] text-muted-foreground">
          {truncate(result.raw_output)}
        </TableCell>
        <TableCell>
          <ScoreBadge score={result.overall_score} />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            {result.flagged && <AlertTriangle className="w-4 h-4 text-red-500" />}
            {result.skip_detected && (
              <span title="LLM skipped — output was retried" className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 font-medium">
                retried
              </span>
            )}
          </div>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/20 p-0">
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">FULL INPUT</p>
                  <p className="text-sm bg-card p-3 rounded-md border font-mono whitespace-pre-wrap">
                    {result.test_input}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">GENERATED OUTPUT</p>
                  <p className="text-sm bg-card p-3 rounded-md border whitespace-pre-wrap">
                    {result.raw_output || "—"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">CRITERION BREAKDOWN</p>
                <Table>
                  <TableHeader>
                    <TRow>
                      <TableHead>Criterion</TableHead>
                      <TableHead className="w-24">Score</TableHead>
                      <TableHead>Reasoning</TableHead>
                    </TRow>
                  </TableHeader>
                  <TableBody>
                    {scores.map((s) => (
                      <TRow key={s.id}>
                        <TableCell className="text-sm font-medium">{s.criterion_name}</TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{s.score}/10</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.reasoning}
                        </TableCell>
                      </TRow>
                    ))}
                    {scores.length === 0 && (
                      <TRow>
                        <TableCell colSpan={3} className="text-sm text-muted-foreground text-center py-3">
                          Loading scores...
                        </TableCell>
                      </TRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {variant && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">EXPERIMENT SUMMARY</p>
                  <div className="text-xs space-y-1 text-foreground">
                    <p><span className="font-medium">Hypothesis:</span> {variant.change_summary}</p>
                    <p><span className="font-medium">Target:</span> {variant.target_criterion}</p>
                    <p><span className="font-medium">Result:</span> Score {variant.original_score} → {variant.variant_score} ({variant.score_delta > 0 ? "+" : ""}{variant.score_delta?.toFixed(1)})</p>
                  </div>
                </div>
              )}

              <div className="text-sm">
                <span className="text-muted-foreground">Overall score: </span>
                <ScoreBadge score={result.overall_score} size="md" />
              </div>
              </div>
              </TableCell>
              </TableRow>
              )}
    </>
  );
}