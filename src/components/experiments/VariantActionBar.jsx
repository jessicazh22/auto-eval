import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";

export default function VariantActionBar({ variant, onActioned }) {
  const [applying, setApplying] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return (
      <div className="px-5 py-3 bg-muted/40 text-xs text-muted-foreground">
        Change dismissed.
      </div>
    );
  }

  const handleApply = async () => {
    setApplying(true);
    // Fetch the improved prompt text from the URL
    const res = await fetch(variant.improved_prompt_text);
    const newText = await res.text();

    // Upload as new file and update the prompt
    const blob = new Blob([newText], { type: "text/plain" });
    const file = new File([blob], "prompt.txt", { type: "text/plain" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    await base44.entities.Prompt.update(variant.prompt_id, { prompt_text: file_url });
    setApplying(false);
    if (onActioned) onActioned("applied");
  };

  return (
    <div className="px-5 py-3 bg-muted/30 border-t border-border flex items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        Apply this change to the live prompt?
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
          onClick={() => setDismissed(true)}
        >
          <X className="w-3.5 h-3.5" />
          Dismiss
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={handleApply}
          disabled={applying}
        >
          {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {applying ? "Applying…" : "Apply to Prompt"}
        </Button>
      </div>
    </div>
  );
}