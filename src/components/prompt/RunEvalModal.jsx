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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Play, X } from "lucide-react";

export default function RunEvalModal({ open, onOpenChange, prompt, criteria, onRunCreated }) {
  const [inputText, setInputText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const inputs = inputText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const callEstimate = inputs.length > 0 ? inputs.length * (criteria.length + 1) : 0;

  const handleRun = async () => {
    if (inputs.length === 0) return;
    setSubmitting(true);

    const run = await base44.entities.EvalRun.create({
      prompt_id: prompt.id,
      status: "pending",
      test_inputs_count: inputs.length,
    });

    // Create EvalResult records for each input
    await base44.entities.EvalResult.bulkCreate(
      inputs.map((input) => ({
        eval_run_id: run.id,
        test_input: input,
      }))
    );

    // Trigger the backend processing
    base44.functions.invoke("runEval", { eval_run_id: run.id });

    setSubmitting(false);
    setInputText("");
    onOpenChange(false);
    onRunCreated(run.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Run Eval — {prompt.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">RUBRIC CRITERIA</p>
            <div className="flex flex-wrap gap-1.5">
              {criteria.map((c) => (
                <Badge key={c.id} variant="secondary" className="text-xs font-normal">
                  {c.name}
                </Badge>
              ))}
              {criteria.length === 0 && (
                <p className="text-sm text-muted-foreground">No criteria defined yet.</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">TEST INPUTS — ONE PER LINE</p>
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your test inputs here, one per line..."
              className="min-h-[160px] font-mono text-sm"
            />
          </div>

          {inputs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{inputs.length} input{inputs.length > 1 ? "s" : ""}</span>
                <span>·</span>
                <span>~{callEstimate} LLM calls</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                {inputs.map((input, i) => (
                  <div
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted text-xs max-w-[300px] truncate"
                  >
                    <span className="text-muted-foreground font-mono mr-1">{i + 1}</span>
                    <span className="truncate">{input}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleRun}
            disabled={inputs.length === 0 || criteria.length === 0 || submitting}
            className="gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            {submitting ? "Starting..." : "Run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}