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
import { Play, Paperclip, AlertCircle } from "lucide-react";

export default function RunEvalModal({ open, onOpenChange, prompt, criteria, onRunCreated }) {
  const [submitting, setSubmitting] = useState(false);

  const attachedFiles = prompt.attached_files || [];
  const callEstimate = attachedFiles.length > 0
    ? attachedFiles.length * (criteria.length + 1)
    : criteria.length + 1;

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

          <p className="text-xs text-muted-foreground">~{callEstimate} LLM calls</p>
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