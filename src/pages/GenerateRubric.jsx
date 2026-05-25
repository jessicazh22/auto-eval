import { useState, useRef } from "react";
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

  // Examples mode state
  const [examples, setExamples] = useState([{ text: "", file: null, annotation: "" }]);

  // General mode state
  const [feedbackText, setFeedbackText] = useState("");
  const [commonFailure, setCommonFailure] = useState("");
  const [successDescription, setSuccessDescription] = useState("");

  // Shared result state
  const [generating, setGenerating] = useState(false);
  const [generatedCriteria, setGeneratedCriteria] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: prompts = [] } = useQuery({
    queryKey: ["prompts"],
    queryFn: () => base44.entities.Prompt.list("-created_date"),
  });

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
      const parts = [];
      if (commonFailure.trim()) parts.push(`Most common failure: ${commonFailure.trim()}`);
      if (successDescription.trim()) parts.push(`What a perfect output looks like: ${successDescription.trim()}`);
      if (feedbackText.trim()) parts.push(feedbackText.trim());
      feedback_text = parts.join("\n\n");
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
    activeTab === "general"
      ? !!(commonFailure.trim() || successDescription.trim() || feedbackText.trim())
      : examples.some((e) => e.text || e.file)
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
        <ExampleAnnotator examples={examples} onChange={setExamples} />
      ) : (
        <div className="space-y-5">
          {/* Quality indicator */}
          {(() => {
            const score = (commonFailure.trim() ? 1 : 0) + (successDescription.trim() ? 1 : 0);
            const levels = [
              { label: "Basic", color: "text-orange-500", bg: "bg-orange-50 border-orange-200", tip: "Add a failure description for better anchors." },
              { label: "Good", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", tip: "Add a success description to complete the picture." },
              { label: "Best", color: "text-green-600", bg: "bg-green-50 border-green-200", tip: "Great — rubric will have concrete anchors for both ends of the scale." },
            ];
            const level = levels[score];
            return (
              <div className={`flex items-start gap-2 px-3 py-2 rounded-md border text-xs ${level.bg}`}>
                <span className={`font-semibold ${level.color}`}>Rubric quality: {level.label}</span>
                <span className="text-muted-foreground">— {level.tip}</span>
              </div>
            );
          })()}

          <div className="space-y-1.5">
            <label className="text-xs font-medium">What's the most common failure you see in current outputs? <span className="text-muted-foreground">(most valuable)</span></label>
            <Textarea
              value={commonFailure}
              onChange={(e) => setCommonFailure(e.target.value)}
              placeholder="e.g. The output adds claims not in the source document, or uses jargon the reader won't understand"
              className="min-h-[80px] text-sm resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">What does a perfect output look like? <span className="text-muted-foreground">(optional)</span></label>
            <Textarea
              value={successDescription}
              onChange={(e) => setSuccessDescription(e.target.value)}
              placeholder="e.g. A 3-sentence summary that covers the main event, uses plain language, and cites only facts from the article"
              className="min-h-[80px] text-sm resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Anything else? <span className="text-muted-foreground">(optional)</span></label>
            <Textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Any other specific qualities that matter, edge cases, or things to avoid"
              className="min-h-[60px] text-sm resize-y"
            />
          </div>
        </div>
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