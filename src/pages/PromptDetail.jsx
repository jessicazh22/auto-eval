import { useState, useCallback, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Play, Paperclip, X, Loader2 } from "lucide-react";
import debounce from "lodash/debounce";
import RubricEditor from "@/components/prompt/RubricEditor";
import EvalRunsTable from "@/components/prompt/EvalRunsTable";
import RunEvalModal from "@/components/prompt/RunEvalModal";
import TestInputManager from "@/components/prompt/TestInputManager";

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
  const [attachedFiles, setAttachedFiles] = useState([]); // [{name, url}]
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [savingText, setSavingText] = useState(false);
  const fileInputRef = useRef(null);

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

  const handleFileAttach = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingFiles(true);
    const uploaded = await Promise.all(
      files.map(async (f) => {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        return { name: f.name, url: file_url };
      })
    );
    const newFiles = [...attachedFiles, ...uploaded];
    setAttachedFiles(newFiles);
    await base44.entities.Prompt.update(prompt.id, { attached_files: newFiles });
    setUploadingFiles(false);
    e.target.value = "";
  };

  const handleRemoveFile = async (index) => {
    const newFiles = attachedFiles.filter((_, i) => i !== index);
    setAttachedFiles(newFiles);
    await base44.entities.Prompt.update(prompt.id, { attached_files: newFiles });
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

        {/* Attached files */}
        <div className="space-y-2">
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-md text-xs text-muted-foreground">
                  <Paperclip className="w-3 h-3" />
                  <a href={f.url} target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors max-w-[180px] truncate">
                    {f.name}
                  </a>
                  <button onClick={() => handleRemoveFile(i)} className="hover:text-destructive transition-colors ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFiles}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {uploadingFiles ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
            {uploadingFiles ? "Uploading..." : "Attach files"}
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileAttach} />
        </div>
      </section>

      {/* Section 2: Test Inputs */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Test Inputs</h2>
        <TestInputManager promptId={promptId} />
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
        <EvalRunsTable runs={runs} />
      </section>

      {showRunModal && (
        <RunEvalModal
          open={showRunModal}
          onOpenChange={setShowRunModal}
          prompt={prompt}
          criteria={criteria}
          onRunCreated={(runId) => {
            queryClient.invalidateQueries({ queryKey: ["runs", promptId] });
          }}
        />
      )}
    </div>
  );
}