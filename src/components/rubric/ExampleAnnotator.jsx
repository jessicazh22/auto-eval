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
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground">Example {index + 1}</span>
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 divide-x divide-border min-h-[220px]">
        {/* Left: Content */}
        <div className="p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Output / Asset</p>
          {example.file ? (
            <div className="space-y-2">
              {isImage ? (
                <img src={example.file.url} alt={example.file.name} className="max-h-48 rounded-md object-contain border border-border" />
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm">
                  <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a href={example.file.url} target="_blank" rel="noreferrer" className="truncate hover:underline text-muted-foreground">
                    {example.file.name}
                  </a>
                </div>
              )}
              <button
                onClick={() => onChange({ ...example, file: null })}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Remove file
              </button>
            </div>
          ) : (
            <div className="space-y-2 h-full">
              <Textarea
                value={example.text || ""}
                onChange={(e) => onChange({ ...example, text: e.target.value })}
                placeholder="Paste example output text here..."
                className="text-sm resize-none min-h-[120px]"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                {uploading ? "Uploading..." : "Or attach a file / image"}
              </button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
            </div>
          )}
        </div>

        {/* Right: Annotation */}
        <div className="p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Comments</p>
          <Textarea
            value={example.annotation || ""}
            onChange={(e) => onChange({ ...example, annotation: e.target.value })}
            placeholder="What's good or bad about this output? What should be different? Be specific..."
            className="text-sm resize-none min-h-[140px]"
          />
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