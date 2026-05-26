export default function DiagnosisBlock({ variant }) {
  return (
    <div className="border-t pt-3 space-y-3">
      {variant.diagnosis && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Diagnosis</p>
          <p className="text-sm leading-relaxed text-foreground">{variant.diagnosis}</p>
        </div>
      )}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase">Experiment Hypothesis</p>
        <p className="text-sm font-medium leading-relaxed">{variant.change_summary}</p>
        {variant.target_criterion && (
          <p className="text-xs text-muted-foreground">
            Targeting: <span className="font-medium text-foreground">{variant.target_criterion}</span>
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Result: {variant.score_delta > 0 ? "✓ Improved" : variant.score_delta < 0 ? "✗ Declined" : "— No change"}{" "}
        ({variant.score_delta > 0 ? "+" : ""}{variant.score_delta?.toFixed(1)})
      </p>
    </div>
  );
}
