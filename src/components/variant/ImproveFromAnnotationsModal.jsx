import { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Plus, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

function AnnotationRow({ annotation, index, onChange, onRemove }) {
  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Example {index + 1}</span>
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <Textarea
        value={annotation.text || ""}
        onChange={(e) => onChange({ ...annotation, text: e.target.value })}
        placeholder="Paste an example output (optional)..."
        className="text-xs font-mono resize-none min-h-[60px]"
      />
      <Textarea
        value={annotation.annotation || ""}
        onChange={(e) => onChange({ ...annotation, annotation: e.target.value })}
        placeholder="What's wrong or right about it? Be specific — e.g. 'tone is too formal', 'missing key context about X'..."
        className="text-xs resize-none min-h-[60px]"
      />
    </div>
  );
}

export default function ImproveFromAnnotationsModal({ open, onOpenChange, evalRunId, promptId, onStarted }) {
  const [annotations, setAnnotations] = useState([{ text: "", annotation: "" }]);
  const [loading, setLoading] = useState(false);

  const addRow = () => setAnnotations(prev => [...prev, { text: "", annotation: "" }]);
  const updateRow = (i, updated) => setAnnotations(prev => prev.map((a, idx) => idx === i ? updated : a));
  const removeRow = (i) => setAnnotations(prev => prev.filter((_, idx) => idx !== i));

  const hasContent = annotations.some(a => a.annotation?.trim());

  const handleSubmit = async () => {
    setLoading(true);
    const res = await base44.functions.invoke("improvePrompt", {
      eval_run_id: evalRunId,
      annotations: annotations.filter(a => a.annotation?.trim()),
    });
    setLoading(false);
    onOpenChange(false);
    onStarted(res.data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Improve Prompt from Annotations</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Add examples of outputs with your comments. The AI will make <strong>one targeted change</strong> to the prompt to address the weakest area, then re-score it so you can see the impact.
          </p>

          <div className="space-y-3">
            {annotations.map((a, i) => (
              <AnnotationRow
                key={i}
                index={i}
                annotation={a}
                onChange={(updated) => updateRow(i, updated)}
                onRemove={() => removeRow(i)}
              />
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add example
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!hasContent || loading} className="gap-1.5">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {loading ? "Generating improvement..." : "Improve Prompt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}