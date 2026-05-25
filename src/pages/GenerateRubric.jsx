import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Check, Info, Save } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  const examplesRef = useRef(examples);

  // General mode state
  const [feedbackText, setFeedbackText] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);
  const [savedDescription, setSavedDescription] = useState(false);

  // Shared result state
  const [generating, setGenerating] = useState(false);
  const [generatedCriteria, setGeneratedCriteria] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [senseCheck, setSenseCheck] = useState(null);
  const [checkingRubric, setCheckingRubric] = useState(false);

  const { data: prompts = [] } = useQuery({
    queryKey: ["prompts"],
    queryFn: () => base44.entities.Prompt.list("-created_date"),
  });

  // Load saved examples + general description when prompt is selected
  useEffect(() => {
    if (!selectedPromptId) return;
    const prompt = prompts.find((p) => p.id === selectedPromptId);
    if (prompt?.rubric_examples?.length > 0) {
      setExamples(prompt.rubric_examples);
    } else {
      setExamples([{ text: "", file: null, annotation: "" }]);
    }
    setFeedbackText(prompt?.general_description || "");
    setSavedDescription(false);
  }, [selectedPromptId, prompts]);

  // Keep ref in sync so onSave always has latest value
  useEffect(() => { examplesRef.current = examples; }, [examples]);

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

    // Combine both sources
    const parts = examples
      .filter((e) => e.text || e.file || e.annotation)
      .map((e, i) => {
        const content = e.file ? `[Attached file: ${e.file.name}]` : e.text || "(no content)";
        const comment = e.annotation || "(no comment)";
        return `Example ${i + 1}:\nOutput: ${content}\nFeedback: ${comment}`;
      });
    const file_urls = examples.filter((e) => e.file?.url).map((e) => e.file.url);

    let feedback_text = parts.join("\n\n");
    if (feedbackText.trim()) {
      feedback_text = feedback_text
        ? `${feedback_text}\n\nGeneral description:\n${feedbackText}`
        : `General description:\n${feedbackText}`;
    }

    const res = await base44.functions.invoke("generateRubric", {
      prompt_id: selectedPromptId,
      feedback_text,
      file_urls,
    });
    const criteria = res.data.criteria || [];
    setGeneratedCriteria(criteria);
    setGenerating(false);

    // Auto sense-check the rubric
    setCheckingRubric(true);
    setSenseCheck(null);
    const checkRes = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert at evaluating LLM evaluation rubrics. A user just generated this rubric from their feedback. Do a quick sense check and give concise, actionable advice.

Rubric criteria:
${criteria.map((c, i) => `${i + 1}. ${c.name} (weight: ${Math.round(c.weight * 100)}%): ${c.description}`).join("\n")}

Respond in JSON with:
- "verdict": "good" | "needs_work" | "poor"
- "summary": one sentence on overall quality
- "suggestions": array of up to 3 short, specific suggestions (what to add, remove, or change). Empty array if none needed.`,
      response_json_schema: {
        type: "object",
        properties: {
          verdict: { type: "string" },
          summary: { type: "string" },
          suggestions: { type: "array", items: { type: "string" } }
        }
      }
    });
    setSenseCheck(checkRes);
    setCheckingRubric(false);
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
    examples.some((e) => e.text || e.file) || !!feedbackText.trim()
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
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Generate Rubric</h1>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors mt-0.5">
                  <Info className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs space-y-1.5 p-3">
                <p className="font-semibold text-sm">What makes a good rubric?</p>
                <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                  <li><span className="text-foreground font-medium">Specific:</span> Each criterion targets one observable trait, not a vague feeling.</li>
                  <li><span className="text-foreground font-medium">Diverse examples:</span> Mix good and bad outputs — explain exactly why each is good or bad.</li>
                  <li><span className="text-foreground font-medium">Cover edge cases:</span> Include tricky or boundary-pushing inputs.</li>
                  <li><span className="text-foreground font-medium">Weighted correctly:</span> Higher weight = more important to your prompt's goal.</li>
                  <li><span className="text-foreground font-medium">3–5 examples</span> is a good start; add more only to cover gaps.</li>
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
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
              await base44.entities.Prompt.update(selectedPromptId, { rubric_examples: examplesRef.current });
              setSavingExamples(false);
            } : undefined}
          />
          <Button onClick={handleGenerate} disabled={!canGenerate || generating} className="gap-2 mt-2">
            {generating && <Loader2 className="w-4 h-4 animate-spin" />}
            {generating ? "Generating rubric..." : "Generate Rubric"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Textarea
            value={feedbackText}
            onChange={(e) => { setFeedbackText(e.target.value); setSavedDescription(false); }}
            placeholder="Describe what a good output looks like, what you want to avoid, specific qualities that matter, etc."
            className="min-h-[160px] text-sm resize-y"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!selectedPromptId || savingDescription || savedDescription}
            onClick={async () => {
              setSavingDescription(true);
              await base44.entities.Prompt.update(selectedPromptId, { general_description: feedbackText });
              setSavingDescription(false);
              setSavedDescription(true);
            }}
            className="gap-1.5"
          >
            {savingDescription ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
            ) : savedDescription ? (
              <><Check className="w-3.5 h-3.5" /> Saved</>
            ) : (
              <><Save className="w-3.5 h-3.5" /> Save Comments</>
            )}
          </Button>
        </div>
      )}

      {/* Generated rubric */}
      {generatedCriteria && (
        <section className="space-y-4 pt-2 border-t border-border">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Review & Edit</h2>

          {/* Sense check panel */}
          {(checkingRubric || senseCheck) && (
            <div className={`rounded-lg border p-4 text-sm space-y-2 ${
              checkingRubric ? "border-border bg-muted/30" :
              senseCheck?.verdict === "good" ? "border-green-200 bg-green-50" :
              senseCheck?.verdict === "needs_work" ? "border-yellow-200 bg-yellow-50" :
              "border-red-200 bg-red-50"
            }`}>
              {checkingRubric ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Checking rubric quality...</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${
                      senseCheck?.verdict === "good" ? "text-green-700" :
                      senseCheck?.verdict === "needs_work" ? "text-yellow-700" :
                      "text-red-700"
                    }`}>
                      {senseCheck?.verdict === "good" ? "Looks good" :
                       senseCheck?.verdict === "needs_work" ? "Needs some work" : "Needs improvement"}
                    </span>
                  </div>
                  <p className="text-foreground">{senseCheck?.summary}</p>
                  {senseCheck?.suggestions?.length > 0 && (
                    <ul className="space-y-1 mt-1">
                      {senseCheck.suggestions.map((s, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-muted-foreground">
                          <span className="mt-0.5 shrink-0">→</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

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