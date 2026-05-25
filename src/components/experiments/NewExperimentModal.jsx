import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function NewExperimentModal({ open, onClose, onStarted }) {
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedCriterion, setSelectedCriterion] = useState("");

  const { data: prompts = [] } = useQuery({
    queryKey: ["prompts"],
    queryFn: () => base44.entities.Prompt.list("-created_date"),
  });

  const { data: runs = [] } = useQuery({
    queryKey: ["runs-for-prompt", selectedPromptId],
    queryFn: () => base44.entities.EvalRun.filter({ prompt_id: selectedPromptId, status: "complete" }, "-created_date"),
    enabled: !!selectedPromptId,
  });

  const selectedRun = runs.find(r => r.id === selectedRunId);
  const criteria = selectedRun?.criterion_averages
    ? Object.entries(selectedRun.criterion_averages).sort((a, b) => a[1] - b[1])
    : [];

  const handlePromptChange = (e) => {
    setSelectedPromptId(e.target.value);
    setSelectedRunId("");
    setSelectedCriterion("");
  };

  const handleRunChange = (e) => {
    setSelectedRunId(e.target.value);
    setSelectedCriterion("");
  };

  const handleSubmit = async () => {
    if (!selectedRunId) return;
    onStarted();
    onClose();
    base44.functions.invoke("improvePrompt", {
      eval_run_id: selectedRunId,
      target_criterion_override: selectedCriterion || undefined,
    }).catch(err => console.error("Experiment generation failed:", err));
  };

  const handleClose = () => {
    setSelectedPromptId("");
    setSelectedRunId("");
    setSelectedCriterion("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Experiment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Prompt */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Prompt</label>
            <select
              value={selectedPromptId}
              onChange={handlePromptChange}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select a prompt…</option>
              {prompts.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Run */}
          {selectedPromptId && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Eval Run (base)</label>
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No completed runs for this prompt.</p>
              ) : (
                <select
                  value={selectedRunId}
                  onChange={handleRunChange}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select a run…</option>
                  {runs.map(r => (
                    <option key={r.id} value={r.id}>
                      {new Date(r.created_date).toLocaleString("en-AU", {
                        timeZone: "Australia/Sydney",
                        day: "numeric", month: "short", year: "numeric",
                        hour: "numeric", minute: "2-digit", hour12: true
                      })} — {r.overall_score?.toFixed(1)}/100
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Criterion */}
          {selectedRun && criteria.length > 0 && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Target Criterion</label>
              <p className="text-xs text-muted-foreground mb-2">Leave blank to auto-target the weakest criterion.</p>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="criterion"
                    value=""
                    checked={selectedCriterion === ""}
                    onChange={() => setSelectedCriterion("")}
                    className="accent-primary"
                  />
                  <span className="text-sm text-muted-foreground">Auto (weakest: {selectedRun.weakest_criterion})</span>
                </label>
                {criteria.map(([name, score]) => (
                  <label key={name} className="flex items-center justify-between gap-2.5 cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="criterion"
                        value={name}
                        checked={selectedCriterion === name}
                        onChange={() => setSelectedCriterion(name)}
                        className="accent-primary"
                      />
                      <span className="text-sm">{name}</span>
                    </div>
                    <span className={`text-xs font-medium tabular-nums ${score < 5 ? "text-red-500" : score < 7 ? "text-amber-600" : "text-green-600"}`}>
                      {score.toFixed(1)}/10
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!selectedRunId}>
            Start Experiment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}