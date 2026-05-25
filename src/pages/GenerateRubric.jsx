import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, ArrowLeft, Check } from "lucide-react";
import GeneratedRubricEditor from "@/components/rubric/GeneratedRubricEditor";
import ExampleAnnotator from "@/components/rubric/ExampleAnnotator";

const TABS = [
  { id: "examples", label: "From Examples", description: "Annotate specific outputs to show what's good or bad" },
  { id: "general", label: "General Description", description: "Describe what great output looks like in your own words" },
];

export default function GenerateRubric() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("examples");
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [savingExamples, setSavingExamples] = useState(false);
  const saveExamplesTimer = useRef(null);

  // Examples mode state
  const [examples, setExamples] = useState([{ text: "", file: null, annotation: "" }]);

  // General mode state
  const [feedbackText, setFeedbackText] = useState("");

  // Shared result state
  const [generating, setGenerating] = useState(false);
  const [generatedCriteria, setGeneratedCriteria] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: prompts = [] } = useQuery({
    queryKey: ["prompts"],
    queryFn: () => base44.entities.Prompt.list("-created_date"),
  });

  // Load saved examples when prompt is selected
  useEffect(() => {
    if (!selectedPromptId) return;
    const prompt = prompts.find((p) => p.id === selectedPromptId);
    if (prompt?.rubric_examples?.length > 0) {
      setExamples(prompt.rubric_examples);
    } else {
      setExamples([{ text: "", file: null, annotation: "" }]);
    }
  }, [selectedPromptId, prompts]);

  // Auto-save examples to prompt entity (debounced)
  const handleExamplesChange = (updated) => {
    setExamples(updated);
    clearTimeout(saveExamplesTimer.current);
    setSavingExamples(true);
    saveExamplesTimer.current = setTimeout(async () => {
      await base44.entities.Prompt.update(selectedPromptId, { rubric_examples: updated });
      setSavingExamples(false);
    }, 1000);
  };

  const handleGenerate = async () => {
    if (!selectedPromptId) return;
    setGenerating(true);
    setGeneratedCriteria(null);
    setSaved(false);

    let feedback_text = "";
    let file_urls = [];

    if (activeTab === "examples") {
      const parts = examples
        .filter((e) => e.text || e.file || e.annotation)
        .map((e, i) => {
          const content = e.file ? `[Attached file: ${e.file.name}]` : e.text || "(no content)";
          const comment = e.annotation || "(no comment)";
          return `Example ${i + 1}:\nOutput: ${content}\nFeedback: ${comment}`;
        });
      feedback_text = parts.join("\n\n");
      file_urls = examples.filter((e) => e.file?.url).map((e) => e.file.url);
    } else {
      feedback_text = feedbackText;
    }

    const res = await base44.functions.invoke("generateRubric", {
      prompt_id: selectedPromptId,
      feedback_text,
      file_urls,
    });
    setGeneratedCriteria(res.data.criteria || []);
    setGenerating(false);
  };

  const handleSave = async (criteria) => {
    setSaving(true);
    const rubrics = await base44.entities.Rubric.filter({ prompt_id: selectedPromptId });
    let rubric = rubrics[0];
    if (!rubric) {
      rubric = await base44.entities.Rubric.create({ prompt_id: selectedPromptId, passing_threshold: 70 });
    } else {
      const existing = await base44.entities.RubricCriterion.filter({ rubric_id: rubric.id });
      await Promise.all(existing.map((c) => base44.entities.RubricCriterion.delete(c.id)));
    }
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

  const canGenerate = !!selectedPromptId && (
    activeTab === "general" ? !!feedbackText.trim() :
    examples.some((e) => e.text || e.file)
  );

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
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
          Let AI generate evaluation criteria based on your inputs.
        </p>
      </div>

      {/* Prompt selector */}
      <section className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prompt</label>
        <Select
          value={selectedPromptId}
          onValueChange={(v) => { setSelectedPromptId(v); setGeneratedCriteria(null); setSaved(false); }}
        >
          <SelectTrigger className="w-full max-w-sm">
            <SelectValue placeholder="Select a prompt..." />
          </SelectTrigger>
          <SelectContent>
            {prompts.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name || "Untitled Prompt"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {/* Mode tabs */}
      <div className="border-b border-border">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setGeneratedCriteria(null); setSaved(false); }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab description */}
      <p className="text-sm text-muted-foreground -mt-4">
        {TABS.find((t) => t.id === activeTab)?.description}
      </p>

      {/* Tab content */}
      {activeTab === "examples" ? (
        <div className="space-y-2">
          {selectedPromptId && (
            <div className="flex justify-end h-4">
              {savingExamples && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                </span>
              )}
            </div>
          )}
          <ExampleAnnotator
            examples={examples}
            onChange={selectedPromptId ? handleExamplesChange : setExamples}
            onSave={selectedPromptId ? async () => {
              clearTimeout(saveExamplesTimer.current);
              setSavingExamples(true);
              await base44.entities.Prompt.update(selectedPromptId, { rubric_examples: examples });
              setSavingExamples(false);
            } : undefined}
          />
        </div>
      ) : (
        <Textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="Describe what a good output looks like, what you want to avoid, specific qualities that matter, etc."
          className="min-h-[160px] text-sm resize-y"
        />
      )}

      {/* Generate button */}
      <Button onClick={handleGenerate} disabled={!canGenerate || generating} className="gap-2">
        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {generating ? "Generating rubric..." : "Generate Rubric"}
      </Button>

      {/* Generated rubric */}
      {generatedCriteria && (
        <section className="space-y-4 pt-2 border-t border-border">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Review & Edit</h2>
          <GeneratedRubricEditor criteria={generatedCriteria} onChange={setGeneratedCriteria} />
          <div className="flex items-center gap-3">
            <Button onClick={() => handleSave(generatedCriteria)} disabled={saving || saved} className="gap-2">
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              ) : saved ? (
                <><Check className="w-4 h-4" /> Saved!</>
              ) : "Save Rubric"}
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