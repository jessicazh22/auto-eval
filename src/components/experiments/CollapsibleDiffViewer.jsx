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

export default function CollapsibleDiffViewer({ originalUrl, improvedUrl }) {
  const [expanded, setExpanded] = useState(false);
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
    return null;
  }

  const diff = computeDiff(original, improved);

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
      >
        <span>View what changed</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
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