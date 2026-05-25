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

  const attachedFiles = prompt.attached_files || [];
  const docsCount = attachedFiles.length || 1;
  // Per doc: 1 generation call + 1 scoring call
  const callEstimate = docsCount * 2;

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

          {/* LLM call breakdown */}
          <div className="border rounded-md p-3 space-y-2 bg-muted/40">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">~{callEstimate} LLM calls</p>
            <div className="space-y-1.5">
              {attachedFiles.length > 0 ? attachedFiles.map((f, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pl-2">
                    <FileText className="w-3 h-3 shrink-0" />
                    <span>1× generate output (system prompt + doc as input)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pl-2">
                    <Scale className="w-3 h-3 shrink-0" />
                    <span>1× score output against {criteria.length} criteria</span>
                  </div>
                </div>
              )) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="w-3 h-3 shrink-0" />
                    <span>1× generate output (system prompt only)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Scale className="w-3 h-3 shrink-0" />
                    <span>1× score output against {criteria.length} criteria</span>
                  </div>
                </div>
              )}
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