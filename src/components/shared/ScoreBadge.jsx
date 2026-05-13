import { cn } from "@/lib/utils";

export default function ScoreBadge({ score, size = "sm" }) {
  if (score === null || score === undefined) {
    return (
      <span className={cn(
        "inline-flex items-center justify-center rounded-full font-medium bg-muted text-muted-foreground",
        size === "sm" && "px-2.5 py-0.5 text-xs",
        size === "md" && "px-3 py-1 text-sm",
        size === "lg" && "px-4 py-1.5 text-base"
      )}>
        —
      </span>
    );
  }

  const rounded = Math.round(score);
  const color = rounded >= 80
    ? "bg-green-50 text-green-700 border-green-200"
    : rounded >= 60
    ? "bg-yellow-50 text-yellow-700 border-yellow-200"
    : "bg-red-50 text-red-700 border-red-200";

  return (
    <span className={cn(
      "inline-flex items-center justify-center rounded-full font-semibold border",
      color,
      size === "sm" && "px-2.5 py-0.5 text-xs",
      size === "md" && "px-3 py-1 text-sm",
      size === "lg" && "px-4 py-1.5 text-lg min-w-[60px]"
    )}>
      {rounded}
    </span>
  );
}