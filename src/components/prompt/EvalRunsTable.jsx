import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ScoreBadge from "@/components/shared/ScoreBadge";
import StatusBadge from "@/components/shared/StatusBadge";
import { ArrowRight } from "lucide-react";

export default function EvalRunsTable({ runs }) {
  if (runs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No eval runs yet — run your first eval above.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Inputs</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run, i) => (
          <TableRow key={run.id} className={i % 2 === 1 ? "bg-muted/30" : ""}>
            <TableCell className="text-sm">
              {format(new Date(run.created_date), "MMM d, yyyy h:mm a")}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {run.test_inputs_count || "—"}
            </TableCell>
            <TableCell>
              <ScoreBadge score={run.status === "complete" ? run.overall_score : null} />
            </TableCell>
            <TableCell>
              <StatusBadge status={run.status} />
            </TableCell>
            <TableCell>
              <Link
                to={`/run/${run.id}`}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}