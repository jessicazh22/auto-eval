import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function DeltaBadge({ delta }) {
  if (delta == null) return null;
  if (delta > 0) return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-green-600">
      <TrendingUp className="w-3.5 h-3.5" />+{delta.toFixed(1)}
    </span>
  );
  if (delta < 0) return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-red-500">
      <TrendingDown className="w-3.5 h-3.5" />{delta.toFixed(1)}
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-muted-foreground">
      <Minus className="w-3 h-3" />0
    </span>
  );
}