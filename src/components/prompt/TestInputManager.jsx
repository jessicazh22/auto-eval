import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Paperclip, X, Loader2, ChevronDown, ChevronRight, Save } from "lucide-react";

function TestInputRow({ input, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [localName, setLocalName] = useState(input.name || "");
  const [localText, setLocalText] = useState("");
  const [refDocs, setRefDocs] = useState(input.reference_docs || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const loadText = async () => {
    if (loaded) return;
    const url = input.system_prompt;
    if (url?.startsWith("http")) {
      const text = await fetch(url).then(r => r.text()).catch(() => "");
      setLocalText(text);
    }
    setLoaded(true);
  };

  const handleExpand = () => {
    if (!expanded) loadText();
    setExpanded(e => !e);
  };

  const handleSave = async () => {
    setSaving(true);
    const file = new File([localText], "system_prompt.txt", { type: "text/plain" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.TestInput.update(input.id, {
      name: localName,
      system_prompt: file_url,
      reference_docs: refDocs,
    });
    queryClient.invalidateQueries({ queryKey: ["test_inputs", input.prompt_id] });
    setSaving(false);
  };

  const handleAttach = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    const uploaded = await Promise.all(
      files.map(async (f) => {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        return { name: f.name, url: file_url };
      })
    );
    setRefDocs(prev => [...prev, ...uploaded]);
    setUploading(false);
    e.target.value = "";
  };

  const removeDoc = (i) => setRefDocs(prev => prev.filter((_, idx) => idx !== i));

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
        <button onClick={handleExpand} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          <span className="text-sm font-medium truncate">{input.name || "Untitled"}</span>
          {refDocs.length > 0 && (
            <span className="text-xs text-muted-foreground shrink-0">· {refDocs.length} doc{refDocs.length > 1 ? "s" : ""}</span>
          )}
        </button>
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors p-1 ml-2 shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="p-4 space-y-4 border-t border-border">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</label>
            <Input
              value={localName}
              onChange={e => setLocalName(e.target.value)}
              placeholder="e.g. Customer service query"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">System Prompt</label>
            <Textarea
              value={localText}
              onChange={e => setLocalText(e.target.value)}
              placeholder="Paste the system prompt / test input here..."
              className="min-h-[140px] font-mono text-sm resize-y"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reference Docs <span className="normal-case font-normal">(optional)</span></label>
            {refDocs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {refDocs.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-md text-xs text-muted-foreground">
                    <Paperclip className="w-3 h-3" />
                    <a href={f.url} target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors max-w-[160px] truncate">{f.name}</a>
                    <button onClick={() => removeDoc(i)} className="hover:text-destructive transition-colors ml-1"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
              {uploading ? "Uploading..." : "Attach reference docs"}
            </button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleAttach} />
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TestInputManager({ promptId }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: testInputs = [] } = useQuery({
    queryKey: ["test_inputs", promptId],
    queryFn: () => base44.entities.TestInput.filter({ prompt_id: promptId }),
    enabled: !!promptId,
  });

  const handleAdd = async () => {
    setCreating(true);
    await base44.entities.TestInput.create({ prompt_id: promptId, name: `Test input ${testInputs.length + 1}` });
    queryClient.invalidateQueries({ queryKey: ["test_inputs", promptId] });
    setCreating(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.TestInput.delete(id);
    queryClient.invalidateQueries({ queryKey: ["test_inputs", promptId] });
  };

  return (
    <div className="space-y-3">
      {testInputs.map(input => (
        <TestInputRow key={input.id} input={input} onDelete={() => handleDelete(input.id)} />
      ))}
      <Button variant="outline" size="sm" onClick={handleAdd} disabled={creating} className="gap-1.5">
        {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        Add test input
      </Button>
    </div>
  );
}