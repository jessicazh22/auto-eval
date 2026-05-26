import { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Paperclip, AlertCircle, FileText, Scale } from "lucide-react";

export default function RunEvalModal({ open, onOpenChange, prompt, criteria, onRunCreated }) {
  const [submitting, setSubmitting] = useState(false);

  const GOLD_MARKER = "__gold_standard__";
  const allFiles = prompt.attached_files || [];
  const attachedFiles = allFiles.filter(f => f.name !== GOLD_MARKER);
  const hasGoldStandard = allFiles.some(f => f.name === GOLD_MARKER);
  const RUNS_PER_DOC = 3;
  const docsCount = attachedFiles.length || 1;
  // Per doc per run: 1 generation + 1 scoring call
  const callEstimate = docsCount * RUNS_PER_DOC * 2;

  const handleRun = async () => {
    setSubmitting(true);

    const run = await base44.entities.EvalRun.create({
      prompt_id: prompt.id,
      status: "pending",
      test_inputs_count: attachedFiles.length || 1,
    });

    base44.functions.invoke("runEval", { eval_run_id: run.id });

    setSubmitting(false);
    onOpenChange(false);
    onRunCreated(run.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Run Eval — {prompt.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Criteria */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Rubric Criteria</p>
            <div className="flex flex-wrap gap-1.5">
              {criteria.map((c) => (
                <Badge key={c.id} variant="secondary" className="text-xs font-normal">
                  {c.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* System prompt preview */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">System Prompt</p>
            <div className="bg-muted rounded-md px-3 py-2 text-xs font-mono text-muted-foreground max-h-24 overflow-y-auto whitespace-pre-wrap">
              {prompt.prompt_text
                ? (prompt.prompt_text.startsWith("http") ? "(stored as file — loaded at runtime)" : prompt.prompt_text)
                : <span className="italic">No prompt text set.</span>}
            </div>
          </div>

          {/* Reference docs as inputs */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Reference Docs (test inputs)</p>
            {attachedFiles.length > 0 ? (
              <div className="space-y-1.5">
                {attachedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Paperclip className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{f.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>No reference docs attached. The eval will run the prompt with no input document.</span>
              </div>
            )}
          </div>

          {/* Gold standard */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gold Standard</span>
            {hasGoldStandard ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 font-medium">✓ Attached — scoring calibrated against ideal output</span>
            ) : (
              <span className="text-xs text-muted-foreground italic">None — scores may be inflated without a reference</span>
            )}
          </div>

          {/* LLM call breakdown */}
          <div className="border rounded-md p-3 space-y-2 bg-muted/40">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              ~{callEstimate} LLM calls ({docsCount} doc{docsCount !== 1 ? "s" : ""} × {RUNS_PER_DOC} runs × 2)
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="w-3 h-3 shrink-0" />
              <span>Each doc is run {RUNS_PER_DOC}× to smooth LLM variance</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Scale className="w-3 h-3 shrink-0" />
              <span>Each run: 1 generation + 1 scoring call against {criteria.length} criteria</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-foreground font-medium">Scores averaged</span>
              <span>across all {docsCount * RUNS_PER_DOC} runs for final result</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleRun}
            disabled={criteria.length === 0 || submitting}
            className="gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            {submitting ? "Starting..." : "Run Eval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}