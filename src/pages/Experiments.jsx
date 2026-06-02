import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, Trash2, CheckCircle } from "lucide-react";
import CollapsibleDiffViewer from "@/components/experiments/CollapsibleDiffViewer";
import NewExperimentModal from "@/components/experiments/NewExperimentModal";
import { Button } from "@/components/ui/button";
import { useVariantPolling } from "@/hooks/useVariantPolling";

const STATUS_FILTERS = ["All", "Complete", "Running", "Failed"];

export default function Experiments() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");

  const [generatingPromptName, setGeneratingPromptName] = useState(() => {
    try {
      const stored = sessionStorage.getItem("experiments_generating");
      if (!stored) return null;
      const { promptName, at } = JSON.parse(stored);
      if (Date.now() - at > 3 * 60 * 1000) {
        sessionStorage.removeItem("experiments_generating");
        return null;
      }
      return promptName || "prompt";
    } catch { return null; }
  });

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ["all-variants"],
    queryFn: async () => {
      const all = await base44.entities.PromptVariant.list("-created_date");
      return all.filter(v => v.status !== "pending_approval" && v.status !== "rejected");
    },
    refetchInterval: 5000,
  });

  const { data: prompts = [] } = useQuery({
    queryKey: ["prompts"],
    queryFn: () => base44.entities.Prompt.list("-created_date"),
  });

  const promptMap = Object.fromEntries(prompts.map(p => [p.id, p]));
  useVariantPolling(variants, queryClient, ["all-variants"]);

  const filterMap = { All: null, Complete: "complete", Running: ["running", "generating"], Failed: "failed" };

  const filteredVariants = variants.filter(v => {
    const f = filterMap[activeFilter];
    if (!f) return true;
    if (Array.isArray(f)) return f.includes(v.status);
    return v.status === f;
  });

  const countFor = (label) => {
    const f = filterMap[label];
    if (!f) return variants.length;
    if (Array.isArray(f)) return variants.filter(v => f.includes(v.status)).length;
    return variants.filter(v => v.status === f).length;
  };

  const hasActiveVariants = variants.some(v => v.status === "running" || v.status === "generating");

  useEffect(() => {
    if (hasActiveVariants && generatingPromptName) {
      sessionStorage.removeItem("experiments_generating");
      setGeneratingPromptName(null);
    }
  }, [hasActiveVariants, generatingPromptName]);

  const showGeneratingPlaceholder = !!generatingPromptName && !hasActiveVariants;

  return (
    <div className="px-12 py-14 max-w-[900px] mx-auto">
      <header className="flex items-end justify-between mb-12">
        <div>
          <p className="text-[12px] uppercase font-bold text-[#a8a29e] tracking-[0.1em] mb-2">Prompt Improvement</p>
          <h1
            className="text-[40px] text-[#0c0a09] leading-[1.1] tracking-tight"
            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500 }}
          >
            Experiments
          </h1>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-6 py-2.5 bg-[#292524] text-white rounded-full text-[15px] font-medium hover:bg-[#0c0a09] transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Experiment
        </button>
      </header>

      <NewExperimentModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onStarted={() => {
          setShowNew(false);
          queryClient.invalidateQueries({ queryKey: ["all-variants"] });
        }}
      />

      {/* Filter tabs */}
      <div className="flex gap-1 mb-8">
        {STATUS_FILTERS.map(label => (
          <button
            key={label}
            onClick={() => setActiveFilter(label)}
            className={`px-4 py-1.5 text-[13px] font-medium rounded-full transition-all ${
              activeFilter === label
                ? "bg-[#f0efed] text-[#0c0a09]"
                : "text-[#777169] hover:text-[#0c0a09]"
            }`}
          >
            {label}{" "}
            <span className="text-[#a8a29e] ml-0.5">{countFor(label)}</span>
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#e7e5e4] border-t-[#292524] rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && variants.length === 0 && !showGeneratingPlaceholder && (
        <div className="bg-white border border-[#e7e5e4] rounded-[16px] p-12 text-center text-[#a8a29e] text-[15px]">
          No experiments yet. Click "Improve Prompt" on a completed eval run to start one.
        </div>
      )}

      <div className="space-y-4">
        {showGeneratingPlaceholder && (
          <div className="bg-white border border-[#e7e5e4] rounded-[16px] overflow-hidden">
            <div className="px-6 py-5 flex items-center justify-between gap-4">
              <div className="space-y-1">
                {generatingPromptName && (
                  <p className="text-[12px] text-[#a8a29e]">{generatingPromptName.length > 40 ? generatingPromptName.slice(0, 40) + "…" : generatingPromptName}</p>
                )}
                <p className="text-[14px] font-semibold text-[#292524]">Generating variants…</p>
                <p className="text-[13px] text-[#777169]">Analysing failing outputs and crafting improvements</p>
              </div>
              <Loader2 className="w-5 h-5 animate-spin text-[#a8a29e] shrink-0" />
            </div>
          </div>
        )}

        {filteredVariants.map((v) => {
          const prompt = promptMap[v.prompt_id];
          return (
            <VariantCard
              key={v.id}
              variant={v}
              promptName={prompt?.name}
              onViewPrompt={() => navigate(`/prompt/${v.prompt_id}`)}
              onViewRun={() => navigate(`/run/${v.variant_eval_run_id}`)}
              onApplied={() => queryClient.invalidateQueries({ queryKey: ["all-variants"] })}
              onDeleted={() => queryClient.invalidateQueries({ queryKey: ["all-variants"] })}
            />
          );
        })}
      </div>
    </div>
  );
}

function VariantCard({ variant, promptName, onViewPrompt, onViewRun, onApplied, onDeleted }) {
  const delta = variant.score_delta;
  const isRunning = variant.status === "running" || variant.status === "generating";
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      let text = variant.improved_prompt_text || "";
      if (text.startsWith("http")) {
        const res = await fetch(text);
        text = await res.text();
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }

  async function handleApply() {
    if (!window.confirm("Apply this variant as the new prompt? This will update the live prompt text.")) return;
    setApplying(true);
    await base44.entities.Prompt.update(variant.prompt_id, { prompt_text: variant.improved_prompt_text });
    setApplied(true);
    setApplying(false);
    onApplied();
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (variant.variant_eval_run_id) {
        await base44.entities.EvalRun.delete(variant.variant_eval_run_id);
      }
      await base44.entities.PromptVariant.delete(variant.id);
    },
    onSuccess: () => onDeleted(),
  });

  if (showDeleteConfirm) {
    return (
      <div className="bg-white border border-[#dc2626]/30 rounded-[16px] bg-[#dc2626]/5 p-5">
        <p className="text-[14px] font-medium text-[#0c0a09] mb-4">Delete this experiment?</p>
        <div className="flex gap-2">
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="px-4 py-1.5 bg-[#dc2626] text-white rounded-full text-[13px] font-medium hover:bg-[#b91c1c] transition-all disabled:opacity-50"
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-4 py-1.5 border border-[#e7e5e4] text-[#292524] rounded-full text-[13px] font-medium hover:border-[#d6d3d1] transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#e7e5e4] rounded-[16px] overflow-hidden hover:border-[#d6d3d1] transition-all">
      <div className="px-6 py-5 flex items-start justify-between gap-6 border-b border-[#f0efed]">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {promptName && (
              <button onClick={onViewPrompt} className="text-[14px] font-semibold text-[#0c0a09] hover:underline">
                {promptName}
              </button>
            )}
            <span className="text-[12px] font-medium px-2.5 py-0.5 rounded-full bg-[#f0efed] text-[#777169]">
              {variant.source === "annotations" ? "From Annotations" : "A/B Tweak"}
            </span>
            {variant.target_criterion && (
              <span className="text-[12px] text-[#777169]">
                targeting <span className="font-medium text-[#292524]">{variant.target_criterion}</span>
              </span>
            )}
          </div>
          {variant.diagnosis && (
            <div className="bg-[#fafafa] rounded-xl px-3.5 py-2.5 border border-[#f0efed]">
              <p className="text-[11px] font-semibold text-[#a8a29e] uppercase tracking-[0.08em] mb-1">Diagnosis</p>
              <p className="text-[13px] text-[#4e4e4e] leading-relaxed">{variant.diagnosis}</p>
            </div>
          )}
          {variant.change_summary && (
            <p className="text-[14px] text-[#292524] font-medium">{variant.change_summary}</p>
          )}
          <p className="text-[12px] text-[#a8a29e]">
            {new Date(variant.created_date).toLocaleString("en-AU", {
              timeZone: "Australia/Sydney",
              month: "short", day: "numeric",
              hour: "numeric", minute: "2-digit", hour12: true
            })}
          </p>
        </div>

        <div className="flex flex-col items-end gap-3 shrink-0 mt-1">
          {isRunning ? (
            <div className="flex items-center gap-2 text-[13px] text-[#777169]">
              <Loader2 className="w-4 h-4 animate-spin" />
              Scoring…
            </div>
          ) : variant.status === "complete" ? (
            <>
              <div className="text-right">
                <p className="text-[11px] text-[#a8a29e] mb-2">Before → After</p>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-[#292524] bg-[#f0efed] px-2.5 py-1 rounded-lg">
                    {variant.original_score ?? "—"}
                  </span>
                  <span className="text-[#a8a29e] text-sm">→</span>
                  <span className="text-[14px] font-semibold text-[#292524] bg-[#f0efed] px-2.5 py-1 rounded-lg">
                    {variant.variant_score ?? "—"}
                  </span>
                  {delta != null && (
                    <span className={`text-[13px] font-semibold px-2 py-0.5 rounded-full ${
                      delta > 0 ? "text-[#16a34a] bg-[#16a34a]/10" : delta < 0 ? "text-[#dc2626] bg-[#dc2626]/10" : "text-[#777169] bg-[#f0efed]"
                    }`}>
                      {delta > 0 ? "+" : ""}{delta}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                {applied ? (
                  <span className="text-[13px] text-[#16a34a] font-medium flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Applied
                  </span>
                ) : (
                  <button
                    onClick={handleApply}
                    disabled={applying}
                    className="px-4 py-1.5 bg-[#292524] text-white rounded-full text-[13px] font-medium hover:bg-[#0c0a09] transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    {applying ? "Applying…" : "Apply to Prompt"}
                  </button>
                )}
                {variant.variant_eval_run_id && (
                  <button
                    onClick={onViewRun}
                    className="text-[13px] font-medium px-4 py-1.5 rounded-full border border-[#e7e5e4] hover:border-[#d6d3d1] text-[#292524] transition-all"
                  >
                    View results
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="text-[13px] font-medium px-4 py-1.5 rounded-full border border-[#e7e5e4] hover:border-[#d6d3d1] text-[#292524] transition-all"
                >
                  {copied ? "Copied!" : "Copy prompt"}
                </button>
              </div>
            </>
          ) : variant.status === "failed" ? (
            <span className="text-[13px] text-[#dc2626]">Failed</span>
          ) : null}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-[#d6d3d1] hover:text-[#dc2626] transition-all p-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {variant.original_prompt_text && variant.improved_prompt_text && (
        <CollapsibleDiffViewer
          originalUrl={variant.original_prompt_text}
          improvedUrl={variant.improved_prompt_text}
        />
      )}
    </div>
  );
}