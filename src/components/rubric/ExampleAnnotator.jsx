import { useState, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Paperclip, X, Loader2, Plus, Trash2, Maximize2, Minimize2, Check } from "lucide-react";

function ExampleSplitView({ example, onChange, fileInputRef, uploading, isImage, onAttachClick, saved }) {
  return (
    <div className="grid grid-cols-2 divide-x divide-border h-full">
      {/* Left: Asset / Output viewer */}
      <div className="flex flex-col min-h-0">
        <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Output / Asset</p>
              {saved && <span className="flex items-center gap-1 text-xs text-green-600"><Check className="w-3 h-3" /> Saved</span>}
            </div>
            {!example.file ? (
            <button
              onClick={onAttachClick}
              disabled={uploading}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
              {uploading ? "Uploading..." : "Attach file"}
            </button>
          ) : (
            <button
              onClick={() => onChange({ ...example, file: null, text: "" })}
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
            >
              <X className="w-3 h-3" /> Remove
            </button>
          )}
        </div>
        <div className="flex-1 p-4 overflow-auto">
          {example.file ? (
            isImage ? (
              <img src={example.file.url} alt={example.file.name} className="w-full h-full object-contain rounded-md" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <Paperclip className="w-8 h-8" />
                <a href={example.file.url} target="_blank" rel="noreferrer" className="text-sm hover:underline text-foreground">
                  {example.file.name}
                </a>
              </div>
            )
          ) : (
            <Textarea
              value={example.text || ""}
              onChange={(e) => onChange({ ...example, text: e.target.value })}
              placeholder="Paste example output text here..."
              className="text-sm resize-none w-full h-full min-h-[320px] border-0 focus-visible:ring-0 shadow-none p-0 font-mono"
            />
          )}
        </div>
      </div>

      {/* Right: Annotation */}
      <div className="flex flex-col min-h-0">
        <div className="px-4 py-2.5 border-b border-border bg-muted/20 shrink-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Comments</p>
        </div>
        <div className="flex-1 p-4 overflow-auto flex flex-col gap-4">
          <Textarea
            value={example.annotation || ""}
            onChange={(e) => onChange({ ...example, annotation: e.target.value })}
            placeholder="What's good or bad about this output? Be specific — e.g. 'tone is too formal', 'missing the key point about X', 'formatting is perfect'..."
            className="text-sm resize-none w-full flex-1 min-h-[160px] border-0 focus-visible:ring-0 shadow-none p-0"
          />
          <div className="rounded-xl border border-[#e7e5e4] bg-[#fafafa] px-4 py-4 shrink-0">
            <p className="text-xs font-semibold text-[#292524] mb-3">Tips for good annotations</p>
            <ul className="space-y-2">
              {ANNOTATION_TIPS.map((tip, i) => (
                <li key={i} className="text-xs text-[#777169] flex gap-2">
                  <span className="text-green-600 shrink-0">✓</span>
                  <span>{tip.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExamplePair({ example, index, onChange, onRemove }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef(null);

  const handleChange = useCallback((updated) => {
    onChange(updated);
    setSaved(false);
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaved(true), 600);
  }, [onChange]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    handleChange({ ...example, file: { name: file.name, url: file_url, type: file.type } });
    setUploading(false);
    e.target.value = "";
  };

  const isImage = example.file?.type?.startsWith("image/");

  const preview = example.file
    ? example.file.name
    : example.text?.trim().slice(0, 80) || null;

  const annotationPreview = example.annotation?.trim().slice(0, 80) || null;

  return (
    <>
      {/* Collapsed card */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-semibold text-muted-foreground shrink-0">Example {index + 1}</span>
            <div className="flex gap-3 min-w-0 text-xs text-muted-foreground truncate">
              {preview ? (
                <span className="truncate italic">"{preview}{example.text?.length > 80 || (example.file?.name?.length > 80) ? '…' : ''}"</span>
              ) : (
                <span className="text-muted-foreground/50">No output yet</span>
              )}
              {annotationPreview && (
                <>
                  <span className="shrink-0">·</span>
                  <span className="truncate">💬 {annotationPreview}{example.annotation?.length > 80 ? '…' : ''}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Edit
            </button>
            <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors p-1">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen overlay */}
      {expanded && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card shrink-0">
            <span className="text-sm font-medium">Example {index + 1}</span>
            <div className="flex items-center gap-2">
              <button onClick={onRemove} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
              <button
                onClick={() => setExpanded(false)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border border-border hover:bg-muted"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                Done
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ExampleSplitView
              example={example}
              onChange={handleChange}
              fileInputRef={fileInputRef}
              uploading={uploading}
              isImage={isImage}
              onAttachClick={() => fileInputRef.current?.click()}
              saved={saved}
            />
          </div>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
        </div>
      )}
    </>
  );
}

const ANNOTATION_TIPS = [
  { text: 'Name the specific failure — "Uses jargon I don\'t know" not just "confusing"' },
  { text: 'Quote the sentence that lost you — "I stopped reading at \'cost-base indexation\'"' },
  { text: 'Separate issues — comprehension, relevance, and length are different problems' },
  { text: 'Include a good example too — note what worked, e.g. "I trust this because the source is named"' },
];

export default function ExampleAnnotator({ examples, onChange }) {
  const addExample = () => {
    onChange([...examples, { text: "", file: null, annotation: "" }]);
  };

  const updateExample = (index, updated) => {
    onChange(examples.map((e, i) => (i === index ? updated : e)));
  };

  const removeExample = (index) => {
    onChange(examples.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {/* Annotation tips — always visible */}
      <div className="rounded-xl border border-[#e7e5e4] bg-[#fafafa] px-4 py-4">
        <p className="text-xs font-semibold text-[#292524] mb-3">Tips for good annotations</p>
        <ul className="space-y-2">
          {ANNOTATION_TIPS.map((tip, i) => (
            <li key={i} className="text-xs text-[#777169] flex gap-2">
              <span className="text-green-600 shrink-0">✓</span>
              <span>{tip.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {examples.map((ex, i) => (
        <ExamplePair
          key={i}
          example={ex}
          index={i}
          onChange={(updated) => updateExample(i, updated)}
          onRemove={() => removeExample(i)}
        />
      ))}
      <Button variant="outline" size="sm" onClick={addExample} className="gap-1.5">
        <Plus className="w-3.5 h-3.5" />
        Add example
      </Button>
    </div>
  );
}