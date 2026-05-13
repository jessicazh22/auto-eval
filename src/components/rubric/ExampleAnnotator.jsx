import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Paperclip, X, Loader2, Plus, Trash2 } from "lucide-react";

function ExamplePair({ example, index, onChange, onRemove }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onChange({ ...example, file: { name: file.name, url: file_url, type: file.type } });
    setUploading(false);
    e.target.value = "";
  };

  const isImage = example.file?.type?.startsWith("image/");

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground">Example {index + 1}</span>
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 divide-x divide-border" style={{ minHeight: "480px" }}>
        {/* Left: Asset / Output viewer */}
        <div className="flex flex-col">
          <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Output / Asset</p>
            {!example.file && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
                {uploading ? "Uploading..." : "Attach file"}
              </button>
            )}
            {example.file && (
              <button
                onClick={() => onChange({ ...example, file: null })}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
              >
                <X className="w-3 h-3" /> Remove
              </button>
            )}
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
          </div>

          <div className="flex-1 p-4 overflow-auto">
            {example.file ? (
              isImage ? (
                <img
                  src={example.file.url}
                  alt={example.file.name}
                  className="w-full h-full object-contain rounded-md"
                />
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
                className="text-sm resize-none w-full h-full min-h-[380px] border-0 focus-visible:ring-0 shadow-none p-0 font-mono"
              />
            )}
          </div>
        </div>

        {/* Right: Annotation */}
        <div className="flex flex-col">
          <div className="px-4 py-2.5 border-b border-border bg-muted/20">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Comments</p>
          </div>
          <div className="flex-1 p-4">
            <Textarea
              value={example.annotation || ""}
              onChange={(e) => onChange({ ...example, annotation: e.target.value })}
              placeholder="What's good or bad about this output? What should be different? Be specific — e.g. 'tone is too formal', 'missing the key point about X', 'formatting is perfect'..."
              className="text-sm resize-none w-full h-full min-h-[380px] border-0 focus-visible:ring-0 shadow-none p-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

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
    <div className="space-y-4">
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