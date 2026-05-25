import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

function computeDiff(original, improved) {
  const origWords = original.split(/(\s+)/);
  const impWords = improved.split(/(\s+)/);
  const m = origWords.length;
  const n = impWords.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (origWords[i] === impWords[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }
  const removedParts = [];
  const addedParts = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (origWords[i] === impWords[j]) {
      removedParts.push({ text: origWords[i], type: "same" });
      addedParts.push({ text: impWords[j], type: "same" });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      removedParts.push({ text: origWords[i], type: "removed" });
      i++;
    } else {
      addedParts.push({ text: impWords[j], type: "added" });
      j++;
    }
  }
  while (i < m) { removedParts.push({ text: origWords[i], type: "removed" }); i++; }
  while (j < n) { addedParts.push({ text: impWords[j], type: "added" }); j++; }
  return { removedParts, addedParts };
}

function extractChangedChunks(parts, type) {
  const changed = [];
  const CONTEXT = 6;
  let i = 0;
  while (i < parts.length) {
    if (parts[i].type === type) {
      const start = Math.max(0, i - CONTEXT);
      let end = i;
      while (end < parts.length && parts[end].type === type) end++;
      end = Math.min(parts.length - 1, end + CONTEXT - 1);
      changed.push(parts.slice(start, end + 1));
      i = end + 1;
    } else {
      i++;
    }
  }
  return changed;
}

function ChangedChunk({ parts, changeType }) {
  return (
    <span className="font-mono text-xs leading-relaxed">
      {parts.map((part, i) =>
        part.type === changeType ? (
          <mark key={i} className={changeType === "removed"
            ? "bg-red-200 text-red-900 rounded-sm px-0.5"
            : "bg-green-200 text-green-900 rounded-sm px-0.5"}>
            {part.text}
          </mark>
        ) : (
          <span key={i} className="text-muted-foreground">{part.text}</span>
        )
      )}
    </span>
  );
}

export default function PromptDiffViewer({ originalUrl, improvedUrl }) {
  const [showFull, setShowFull] = useState(false);
  const [original, setOriginal] = useState(null);
  const [improved, setImproved] = useState(null);

  useEffect(() => {
    if (original && improved) return;
    Promise.all([
      originalUrl.startsWith("http") ? fetch(originalUrl).then(r => r.text()) : Promise.resolve(originalUrl),
      improvedUrl.startsWith("http") ? fetch(improvedUrl).then(r => r.text()) : Promise.resolve(improvedUrl),
    ]).then(([o, im]) => { setOriginal(o); setImproved(im); });
  }, [originalUrl, improvedUrl]);

  if (!original || !improved) {
    return <div className="px-5 py-3 text-xs text-muted-foreground border-t border-border">Loading diff…</div>;
  }

  const diff = computeDiff(original, improved);
  const removedChunks = extractChangedChunks(diff.removedParts, "removed");
  const addedChunks = extractChangedChunks(diff.addedParts, "added");
  const hasChanges = removedChunks.length > 0 || addedChunks.length > 0;

  return (
    <div className="border-t border-border">
      {hasChanges ? (
        <div className="px-5 py-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">What changed</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              {removedChunks.length > 0 && <p className="text-xs font-semibold text-red-600 mb-1">Removed</p>}
              {removedChunks.map((chunk, i) => (
                <div key={i} className="bg-red-50 border border-red-100 rounded px-2 py-1.5">
                  <ChangedChunk parts={chunk} changeType="removed" />
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              {addedChunks.length > 0 && <p className="text-xs font-semibold text-green-700 mb-1">Added</p>}
              {addedChunks.map((chunk, i) => (
                <div key={i} className="bg-green-50 border border-green-100 rounded px-2 py-1.5">
                  <ChangedChunk parts={chunk} changeType="added" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-5 py-3 text-xs text-muted-foreground">No textual changes detected.</div>
      )}

      <button
        onClick={() => setShowFull(p => !p)}
        className="w-full flex items-center justify-between px-5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors border-t border-border"
      >
        <span>View full diff</span>
        {showFull ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {showFull && (
        <div className="grid grid-cols-2 divide-x divide-border border-t border-border text-xs font-mono">
          <div className="p-4 bg-red-50/40">
            <p className="text-xs font-semibold text-red-600 mb-2 uppercase tracking-wider font-sans">Before</p>
            <p className="whitespace-pre-wrap leading-relaxed">
              {diff.removedParts.map((part, i) =>
                part.type === "removed"
                  ? <mark key={i} className="bg-red-200 text-red-900 rounded-sm">{part.text}</mark>
                  : <span key={i}>{part.text}</span>
              )}
            </p>
          </div>
          <div className="p-4 bg-green-50/40">
            <p className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wider font-sans">After</p>
            <p className="whitespace-pre-wrap leading-relaxed">
              {diff.addedParts.map((part, i) =>
                part.type === "added"
                  ? <mark key={i} className="bg-green-200 text-green-900 rounded-sm">{part.text}</mark>
                  : <span key={i}>{part.text}</span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}