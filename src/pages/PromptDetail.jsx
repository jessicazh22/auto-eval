import { useState, useCallback, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Play, Loader2, Paperclip, X } from "lucide-react";
import debounce from "lodash/debounce";
import RubricEditor from "@/components/prompt/RubricEditor";
import EvalRunsTable from "@/components/prompt/EvalRunsTable";
import RunEvalModal from "@/components/prompt/RunEvalModal";
import ReferenceDocs from "@/components/prompt/ReferenceDocs";

export default function PromptDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const promptId = window.location.pathname.split("/prompt/")[1];
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showRunModal, setShowRunModal] = useState(false);

  const { data: prompt, isLoading: loadingPrompt } = useQuery({
    queryKey: ["prompt", promptId],
    queryFn: async () => {
      const prompts = await base44.entities.Prompt.filter({ id: promptId });
      return prompts[0] || null;
    },
    enabled: !!promptId,
  });

  const { data: rubrics } = useQuery({
    queryKey: ["rubric", promptId],
    queryFn: () => base44.entities.Rubric.filter({ prompt_id: promptId }),
    enabled: !!promptId,
    initialData: [],
  });
  const rubric = rubrics[0] || null;

  const { data: criteria } = useQuery({
    queryKey: ["criteria", rubric?.id],
    queryFn: () => base44.entities.RubricCriterion.filter({ rubric_id: rubric.id }),
    enabled: !!rubric?.id,
    initialData: [],
  });

  const { data: runs } = useQuery({
    queryKey: ["runs", promptId],
    queryFn: () => base44.entities.EvalRun.filter({ prompt_id: promptId }, "-created_date"),
    enabled: !!promptId,
    initialData: [],
  });

  // Poll for running eval runs
  const hasRunning = runs.some((r) => r.status === "running" || r.status === "pending");
  useEffect(() => {
    if (!hasRunning) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["runs", promptId] });
    }, 3000);
    return () => clearInterval(interval);
  }, [hasRunning, promptId, queryClient]);

  const [localName, setLocalName] = useState("");
  const [localText, setLocalText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [savingText, setSavingText] = useState(false);

  useEffect(() => {
    if (prompt) {
      setLocalName(prompt.name || "");
      // prompt_text may be a URL (uploaded file) or raw text
      const text = prompt.prompt_text || "";
      if (text.startsWith("http")) {
        fetch(text).then(r => r.text()).then(setLocalText).catch(() => setLocalText(""));
      } else {
        setLocalText(text);
      }
      setAttachedFiles(prompt.attached_files || []);
    }
  }, [prompt]);

  const debouncedSaveName = useCallback(
    debounce(async (id, name) => {
      await base44.entities.Prompt.update(id, { name });
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
    }, 800),
    []
  );

  const debouncedSaveText = useCallback(
    debounce(async (id, text) => {
      setSavingText(true);
      const file = new File([text], "prompt.txt", { type: "text/plain" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Prompt.update(id, { prompt_text: file_url });
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      setSavingText(false);
    }, 1200),
    []
  );

  const handleNameChange = (value) => {
    setLocalName(value);
    if (prompt) debouncedSaveName(prompt.id, value);
  };

  const handleTextChange = (value) => {
    setLocalText(value);
    if (prompt) debouncedSaveText(prompt.id, value);
  };


  if (loadingPrompt) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Prompt not found.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to prompts
      </button>

      {/* Section 1: Prompt */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prompt</h2>
        <Input
          value={localName}
          onChange={(e) => handleNameChange(e.target.value)}
          className="text-lg font-semibold h-10 border-0 px-0 focus-visible:ring-0 shadow-none"
          placeholder="Prompt name"
        />
        <div className="relative">
          <Textarea
            value={localText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Write your prompt text here..."
            className="min-h-[160px] font-mono text-sm resize-y pr-8"
          />
          {savingText && (
            <div className="absolute top-2 right-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Reference Docs */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reference Docs</p>
          <ReferenceDocs
            attachedFiles={attachedFiles}
            onFilesChange={async (newFiles) => {
              setAttachedFiles(newFiles);
              await base44.entities.Prompt.update(prompt.id, { attached_files: newFiles });
            }}
            promptId={promptId}
          />
        </div>
      </section>

      {/* Gold Standard */}
      <section className="space-y-2">
        <div>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gold Standard Output</h2>
          <p className="text-xs text-muted-foreground mt-0.5">An ideal output example. When attached, the eval judge calibrates scores against it — outputs matching it score 8–10, outputs far from it score 1–3.</p>
        </div>
        <GoldStandardUpload prompt={prompt} onSaved={() => queryClient.invalidateQueries({ queryKey: ["prompt", promptId] })} />
      </section>

      {/* Section 3: Rubric */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rubric</h2>
        {rubric ? (
          <RubricEditor
            rubric={rubric}
            criteria={criteria}
            onCriteriaChange={() => queryClient.invalidateQueries({ queryKey: ["criteria", rubric.id] })}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Loading rubric...</p>
        )}
      </section>

      {/* Section 3: Eval Runs */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Eval Runs</h2>
          <Button
            size="sm"
            onClick={() => setShowRunModal(true)}
            disabled={criteria.length === 0}
            className="gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            Run Eval
          </Button>
        </div>
        <EvalRunsTable runs={runs} promptId={promptId} />
      </section>

      {showRunModal && (
        <RunEvalModal
          open={showRunModal}
          onOpenChange={setShowRunModal}
          prompt={{ ...prompt, attached_files: attachedFiles }}
          criteria={criteria}
          onRunCreated={(runId) => {
            queryClient.invalidateQueries({ queryKey: ["runs", promptId] });
          }}
        />
      )}
    </div>
  );
}

function GoldStandardUpload({ prompt, onSaved }) {
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [localUrl, setLocalUrl] = useState(null);
  const fileInputRef = useRef(null);

  const activeUrl = localUrl ?? prompt?.gold_standard_url;

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Prompt.update(prompt.id, { gold_standard_url: file_url });
      setLocalUrl(file_url);
      onSaved();
    } catch (err) {
      console.error("Gold standard upload failed:", err);
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleRemove = async () => {
    setRemoving(true);
    await base44.entities.Prompt.update(prompt.id, { gold_standard_url: null });
    setLocalUrl(null);
    onSaved();
    setRemoving(false);
  };

  if (activeUrl) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 border border-green-200 rounded-md text-xs text-green-700">
          <Paperclip className="w-3 h-3" />
          <a href={activeUrl} target="_blank" rel="noreferrer" className="hover:underline">
            Gold standard attached
          </a>
        </div>
        <button
          onClick={handleRemove}
          disabled={removing}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
        >
          {removing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
          Remove
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
        {uploading ? "Uploading..." : "Attach gold standard (.txt)"}
      </button>
      <input ref={fileInputRef} type="file" accept=".txt,.md" className="hidden" onChange={handleUpload} />
    </>
  );
}