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
  {
    id: "examples",
    label: "From Examples",
    time: "~10 min",
    when: "Use when you have real outputs you've already reviewed — paste or upload them with your reactions. Best rubric quality.",
    description: "Paste or upload real outputs with your reactions — quote specific sentences that confused you or worked well",
  },
  {
    id: "general",
    label: "General Description",
    time: "~2 min",
    when: "Use when you're starting fresh or don't have examples yet. Good enough to start evaluating immediately.",
    description: "Describe what failures look like and what a perfect output looks like — no examples needed",
  },
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
  const [hasExistingRubric, setHasExistingRubric] = useState(false);
  const [noSavedInputs, setNoSavedInputs] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importError, setImportError] = useState("");

  const { data: prompts = [] } = useQuery({
    queryKey: ["prompts"],
    queryFn: () => base44.entities.Prompt.list("-created_date"),
  });

  // Load saved annotations when prompt changes
  const handlePromptChange = async (promptId) => {
    setSelectedPromptId(promptId);
    setGeneratedCriteria(null);
    setSaved(false);
    if (!promptId) return;
    const rubrics = await base44.entities.Rubric.filter({ prompt_id: promptId });
    const rubric = rubrics[0];
    setHasExistingRubric(!!rubric);
    setNoSavedInputs(false);
    if (!rubric?.annotation_text) {
      if (rubric) {
        // Auto-seed annotations for this prompt then reload
        const prompt = prompts.find(p => p.id === promptId);
        if (prompt) {
          await base44.functions.invoke("seedAnnotations", { prompt_name: prompt.name }).catch(() => {});
          // Re-fetch rubric with seeded data
          const fresh = await base44.entities.Rubric.filter({ prompt_id: promptId });
          if (fresh[0]?.annotation_text) {
            const saved = JSON.parse(fresh[0].annotation_text);
            if (saved.__version === 2) {
              setActiveTab(saved.mode || "examples");
              if (saved.mode === "general") {
                setCommonFailure(saved.general?.commonFailure || "");
                setSuccessDescription(saved.general?.successDescription || "");
                setFeedbackText(saved.general?.feedbackText || "");
              } else {
                const restored = (saved.examples || []).map((e) => ({
                  text: e.fileUrl ? "" : e.text || "",
                  file: e.fileUrl ? { name: e.fileName, url: e.fileUrl } : null,
                  annotation: e.annotation || "",
                }));
                setExamples(restored.length > 0 ? restored : [{ text: "", file: null, annotation: "" }]);
                setCommonFailure(saved.general?.commonFailure || "");
                setSuccessDescription(saved.general?.successDescription || "");
              }
            }
          }
        }
      }
      return;
    }
    try {
      const saved = JSON.parse(rubric.annotation_text);
      if (saved.__version !== 2) throw new Error("old format");
      if (saved.__version === 2) {
        setActiveTab(saved.mode || "examples");
        if (saved.mode === "general") {
          setCommonFailure(saved.general?.commonFailure || "");
          setSuccessDescription(saved.general?.successDescription || "");
          setFeedbackText(saved.general?.feedbackText || "");
        } else {
          const restored = (saved.examples || []).map((e) => ({
            text: e.fileUrl ? "" : e.text || "",
            file: e.fileUrl ? { name: e.fileName, url: e.fileUrl } : null,
            annotation: e.annotation || "",
          }));
          setExamples(restored.length > 0 ? restored : [{ text: "", file: null, annotation: "" }]);
          // Also restore general context even in examples mode
          setCommonFailure(saved.general?.commonFailure || "");
          setSuccessDescription(saved.general?.successDescription || "");
        }
        return;
      }
    } catch (_) {
      // Old format or parse error — seed with structured data and reload
      const prompt = prompts.find(p => p.id === promptId);
      if (prompt) {
        await base44.functions.invoke("seedAnnotations", { prompt_name: prompt.name }).catch(() => {});
        const fresh = await base44.entities.Rubric.filter({ prompt_id: promptId });
        if (fresh[0]?.annotation_text) {
          try {
            const seeded = JSON.parse(fresh[0].annotation_text);
            if (seeded.__version === 2) {
              setActiveTab(seeded.mode || "examples");
              const restored = (seeded.examples || []).map((e: any) => ({
                text: e.fileUrl ? "" : e.text || "",
                file: e.fileUrl ? { name: e.fileName, url: e.fileUrl } : null,
                annotation: e.annotation || "",
              }));
              setExamples(restored.length > 0 ? restored : [{ text: "", file: null, annotation: "" }]);
              setCommonFailure(seeded.general?.commonFailure || "");
              setSuccessDescription(seeded.general?.successDescription || "");
            }
          } catch (_2) {}
        }
      }
    }
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

    // Persist full state as JSON so it can be restored exactly
    const savedState = activeTab === "general"
      ? { __version: 2, mode: "general", general: { commonFailure, successDescription, feedbackText } }
      : {
          __version: 2,
          mode: "examples",
          examples: examples.filter(e => e.text || e.file || e.annotation).map(e => ({
            text: e.file ? "" : e.text || "",
            fileName: e.file?.name || null,
            fileUrl: e.file?.url || null,
            annotation: e.annotation || "",
          })),
        };
    const savedAnnotationText = JSON.stringify(savedState);
    const savedFileUrls = activeTab === "examples"
      ? examples.filter(e => e.file?.url).map(e => e.file.url)
      : [];

    const rubrics = await base44.entities.Rubric.filter({ prompt_id: selectedPromptId });
    let rubric = rubrics[0];
    if (!rubric) {
      rubric = await base44.entities.Rubric.create({
        prompt_id: selectedPromptId,
        passing_threshold: 70,
        annotation_text: savedAnnotationText,
        annotation_file_urls: savedFileUrls,
      });
    } else {
      await base44.entities.Rubric.update(rubric.id, {
        annotation_text: savedAnnotationText,
        annotation_file_urls: savedFileUrls,
      });
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
    <div className="px-12 py-14 max-w-[860px] mx-auto space-y-8">
      <button
        onClick={() => navigate("/")}
        className="inline-flex items-center gap-1.5 text-[14px] text-[#777169] hover:text-[#0c0a09] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to prompts
      </button>

      <div>
        <p className="text-[12px] uppercase font-bold text-[#a8a29e] tracking-[0.1em] mb-2">Rubric Builder</p>
        <h1
          className="text-[40px] text-[#0c0a09] leading-[1.1] tracking-tight mb-2"
          style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}
        >
          Generate Rubric
        </h1>
        <p className="text-[16px] text-[#777169] leading-relaxed">
          Let AI generate evaluation criteria based on your inputs.
        </p>
      </div>

      {/* Prompt selector */}
      <section className="space-y-3">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#a8a29e]">Prompt</label>
        <Select
          value={selectedPromptId}
          onValueChange={handlePromptChange}
        >
          <SelectTrigger className="w-72 bg-white border-[#e7e5e4] rounded-xl text-[15px] text-[#292524] font-medium">
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
              <span>{tab.label}</span>
              <span className={`ml-1.5 text-[10px] font-normal ${activeTab === tab.id ? "text-muted-foreground/60" : "text-muted-foreground/40"}`}>
                {tab.time}
              </span>
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