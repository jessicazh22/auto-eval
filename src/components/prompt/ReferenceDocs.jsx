import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Paperclip, X, Loader2, FileText, Save, ToggleLeft, ToggleRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

// A single reference doc entry — either an uploaded file or pasted text
function PastedDoc({ doc, onRemove }) {
  return (
    <div className="flex items-start gap-1.5 px-2.5 py-1.5 bg-muted rounded-md text-xs text-muted-foreground">
      <FileText className="w-3 h-3 mt-0.5 shrink-0" />
      <span className="truncate max-w-[200px]">{doc.name}</span>
      <button onClick={onRemove} className="hover:text-destructive transition-colors ml-1 shrink-0">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function UploadedDoc({ doc, onRemove }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-md text-xs text-muted-foreground">
      <Paperclip className="w-3 h-3 shrink-0" />
      <a href={doc.url} target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors max-w-[180px] truncate">
        {doc.name}
      </a>
      <button onClick={onRemove} className="hover:text-destructive transition-colors ml-1 shrink-0">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function ReferenceDocs({ attachedFiles, onFilesChange, promptId }) {
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteName, setPasteName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileAttach = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    const uploaded = await Promise.all(
      files.map(async (f) => {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        return { name: f.name, url: file_url };
      })
    );
    onFilesChange([...attachedFiles, ...uploaded]);
    setUploading(false);
    e.target.value = "";
  };

  const handleSavePaste = async () => {
    if (!pasteText.trim()) return;
    setSaving(true);
    const name = pasteName.trim() || `Reference doc ${attachedFiles.length + 1}`;
    const file = new File([pasteText], `${name}.txt`, { type: "text/plain" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onFilesChange([...attachedFiles, { name, url: file_url }]);
    setPasteText("");
    setPasteName("");
    setPasteMode(false);
    setSaving(false);
  };

  const handleRemove = (index) => {
    onFilesChange(attachedFiles.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {/* Existing docs */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachedFiles.map((f, i) => (
            <UploadedDoc key={i} doc={f} onRemove={() => handleRemove(i)} />
          ))}
        </div>
      )}

      {/* Paste-in panel */}
      {pasteMode && (
        <div className="border border-border rounded-lg p-3 space-y-2 bg-card">
          <input
            type="text"
            value={pasteName}
            onChange={e => setPasteName(e.target.value)}
            placeholder="Doc name (optional)"
            className="w-full h-7 text-xs border border-input rounded-md px-2 bg-background"
          />
          <Textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder="Paste reference doc content here..."
            className="min-h-[120px] font-mono text-xs resize-y"
          />
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => setPasteMode(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <Button size="sm" onClick={handleSavePaste} disabled={saving || !pasteText.trim()} className="gap-1.5 h-7 text-xs">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save doc
            </Button>
          </div>
        </div>
      )}

      {/* Actions row */}
      {!pasteMode && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
            {uploading ? "Uploading..." : "Attach reference doc"}
          </button>
          <span className="text-muted-foreground/40 text-xs">or</span>
          <button
            onClick={() => setPasteMode(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Paste text
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileAttach} />
        </div>
      )}
    </div>
  );
}