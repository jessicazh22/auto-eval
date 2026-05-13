import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

const statusConfig = {
  pending: { label: "Pending", icon: Clock, className: "bg-muted text-muted-foreground" },
  running: { label: "Running", icon: Loader2, className: "bg-blue-50 text-blue-700 border-blue-200" },
  complete: { label: "Complete", icon: CheckCircle2, className: "bg-green-50 text-green-700 border-green-200" },
  failed: { label: "Failed", icon: XCircle, className: "bg-red-50 text-red-700 border-red-200" },
};

export default function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border", config.className)}>
      <Icon className={cn("w-3 h-3", status === "running" && "animate-spin")} />
      {config.label}
    </span>
  );
}