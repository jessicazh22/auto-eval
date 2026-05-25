import { useState } from "react";
import { Link } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ScoreBadge from "@/components/shared/ScoreBadge";
import StatusBadge from "@/components/shared/StatusBadge";
import { ArrowRight, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";

function formatAEST(dateStr) {
  return new Date(dateStr).toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }) + " AEST";
}

export default function EvalRunsTable({ runs, promptId }) {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(null);

  if (runs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No eval runs yet — run your first eval above.
      </p>
    );
  }

  const showInputs = runs.some(r => (r.test_inputs_count || 0) > 1);

  const handleDelete = async (runId) => {
    setDeleting(runId);
    await base44.entities.EvalRun.delete(runId);
    queryClient.invalidateQueries({ queryKey: ["evalRuns", promptId] });
    setDeleting(null);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date (AEST)</TableHead>
          {showInputs && <TableHead>Inputs</TableHead>}
          <TableHead>Score</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-16" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run, i) => (
          <TableRow key={run.id} className={i % 2 === 1 ? "bg-muted/30" : ""}>
            <TableCell className="text-sm">{formatAEST(run.created_date)}</TableCell>
            {showInputs && (
              <TableCell className="text-sm text-muted-foreground">
                {run.test_inputs_count || "—"}
              </TableCell>
            )}
            <TableCell>
              <ScoreBadge score={run.status === "complete" ? run.overall_score : null} />
            </TableCell>
            <TableCell>
              <StatusBadge status={run.status} />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDelete(run.id)}
                  disabled={deleting === run.id}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1 disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <Link to={`/run/${run.id}`} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}