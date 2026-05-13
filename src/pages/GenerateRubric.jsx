import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip, X, Loader2, Sparkles, ArrowLeft, Check } from "lucide-react";
import GeneratedRubricEditor from "@/components/rubric/GeneratedRubricEditor";

export default function GenerateRubric() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]); // [{name, url}]
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedCriteria, setGeneratedCriteria] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: prompts = [] } = useQuery({
    queryKey: ["prompts"],
    queryFn: () => base44.entities.Prompt.list("-created_date"),
  });

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingFiles(true);
    const uploaded = await Promise.all(
      files.map(async (f) => {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        return { name: f.name, url: file_url };
      })
    );
    setUploadedFiles((prev) => [...prev, ...uploaded]);
    setUploadingFiles(false);
    e.target.value = "";
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!selectedPromptId) return;
    setGenerating(true);
    setGeneratedCriteria(null);
    setSaved(false);
    const res = await base44.functions.invoke("generateRubric", {
      prompt_id: selectedPromptId,
      feedback_text: feedbackText,
      file_urls: uploadedFiles.map((f) => f.url),
    });
    setGeneratedCriteria(res.data.criteria || []);
    setGenerating(false);
  };

  const handleSave = async (criteria) => {
    setSaving(true);
    // Get or create rubric for prompt
    const rubrics = await base44.entities.Rubric.filter({ prompt_id: selectedPromptId });
    let rubric = rubrics[0];
    if (!rubric) {
      rubric = await base44.entities.Rubric.create({ prompt_id: selectedPromptId, passing_threshold: 70 });
    } else {
      // Delete existing criteria
      const existing = await base44.entities.RubricCriterion.filter({ rubric_id: rubric.id });
      await Promise.all(existing.map((c) => base44.entities.RubricCriterion.delete(c.id)));
    }

    // Create new criteria
    await Promise.all(
      criteria.map((c) =>
        base44.entities.RubricCriterion.create({
          rubric_id: rubric.id,
          name: c.name,
          description: c.description,
          weight: c.weight,
        })
      )
    );

    queryClient.invalidateQueries({ queryKey: ["criteria"] });
    queryClient.invalidateQueries({ queryKey: ["rubric", selectedPromptId] });
    setSaving(false);
    setSaved(true);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to prompts
      </button>

      <div>
        <h1 className="text-2xl font-semibold">Generate Rubric</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select a prompt, provide feedback or examples, and let AI generate evaluation criteria for you.
        </p>
      </div>

      {/* Step 1: Select Prompt */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">1. Select Prompt</h2>
        <Select value={selectedPromptId} onValueChange={(v) => { setSelectedPromptId(v); setGeneratedCriteria(null); setSaved(false); }}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a prompt..." />
          </SelectTrigger>
          <SelectContent>
            {prompts.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name || "Untitled Prompt"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {/* Step 2: Feedback */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">2. Describe your expectations</h2>
        <Textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="Describe what a good output looks like, what you want to avoid, specific qualities that matter, etc."
          className="min-h-[140px] text-sm resize-y"
        />

        {/* File uploads */}
        <div className="space-y-2">
          {uploadedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-muted rounded-md text-xs text-muted-foreground">
                  <Paperclip className="w-3 h-3" />
                  <span className="max-w-[160px] truncate">{f.name}</span>
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
            {uploadingFiles ? "Uploading..." : "Attach example outputs or reference files"}
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
        </div>
      </section>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={!selectedPromptId || generating}
        className="gap-2 w-full sm:w-auto"
      >
        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {generating ? "Generating rubric..." : "Generate Rubric"}
      </Button>

      {/* Step 3: Review & Save */}
      {generatedCriteria && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">3. Review & save</h2>
          <GeneratedRubricEditor criteria={generatedCriteria} onChange={setGeneratedCriteria} />
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={() => handleSave(generatedCriteria)} disabled={saving || saved} className="gap-2">
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              ) : saved ? (
                <><Check className="w-4 h-4" /> Saved!</>
              ) : (
                "Save Rubric"
              )}
            </Button>
            {saved && (
              <button
                onClick={() => navigate(`/prompt/${selectedPromptId}`)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                View prompt →
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}