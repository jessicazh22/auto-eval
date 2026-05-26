import { useNavigate } from "react-router-dom";
import DiagnosisBlock from "./DiagnosisBlock";

export default function CriterionComparison({ run, parentRun, variant }) {
  const navigate = useNavigate();

  return (
    <div className="border rounded-lg p-4 bg-card space-y-4">
      <h2 className="text-sm font-semibold">
        Criterion Comparison
        <button
          onClick={() => navigate(`/run/${parentRun.id}`)}
          className="text-xs font-normal text-primary hover:underline ml-2"
        >
          vs {new Date(parentRun.created_date).toLocaleString("en-AU", {
            timeZone: "Australia/Sydney",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}
        </button>
      </h2>
      <div className="grid grid-cols-2 gap-4 text-xs">
        {Object.entries(run.criterion_averages || {}).map(([criterion, score]) => {
          const parentScore = parentRun.criterion_averages?.[criterion] || 0;
          const delta = score - parentScore;
          return (
            <div key={criterion} className="border rounded p-3 space-y-1">
              <p className="font-medium text-foreground">{criterion}</p>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{parentScore.toFixed(1)}</span>
                <span className="text-muted-foreground">→</span>
                <span className={delta > 0 ? "text-green-600 font-semibold" : delta < 0 ? "text-red-600 font-semibold" : ""}>
                  {score.toFixed(1)}
                </span>
                {delta !== 0 && (
                  <span className={`text-xs ${delta > 0 ? "text-green-600" : "text-red-600"}`}>
                    ({delta > 0 ? "+" : ""}{delta.toFixed(1)})
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {variant && <DiagnosisBlock variant={variant} />}
    </div>
  );
}
