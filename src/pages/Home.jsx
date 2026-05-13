import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ScoreBadge from "@/components/shared/ScoreBadge";
import { Plus, FileText } from "lucide-react";
import { format } from "date-fns";

export default function Home() {
  const navigate = useNavigate();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: prompts, isLoading } = useQuery({
    queryKey: ["prompts"],
    queryFn: () => base44.entities.Prompt.list("-created_date"),
    initialData: [],
  });

  const { data: runs } = useQuery({
    queryKey: ["all-runs"],
    queryFn: () => base44.entities.EvalRun.list("-created_date"),
    initialData: [],
  });

  const getLastRun = (promptId) => {
    const promptRuns = runs
      .filter((r) => r.prompt_id === promptId && r.status === "complete")
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    return promptRuns[0] || null;
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const prompt = await base44.entities.Prompt.create({
      name: newName.trim(),
      prompt_text: "",
    });
    // Create a default rubric
    await base44.entities.Rubric.create({
      prompt_id: prompt.id,
      passing_threshold: 70,
    });
    setCreating(false);
    setShowNew(false);
    setNewName("");
    navigate(`/prompt/${prompt.id}`);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prompts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define prompts, build rubrics, and run evaluations.
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-1.5">
          <Plus className="w-4 h-4" />
          New Prompt
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
        </div>
      ) : prompts.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No prompts yet. Create your first one.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-32">Last Score</TableHead>
                <TableHead className="w-44">Last Run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prompts.map((prompt, i) => {
                const lastRun = getLastRun(prompt.id);
                return (
                  <TableRow
                    key={prompt.id}
                    className={`cursor-pointer hover:bg-muted/50 transition-colors ${i % 2 === 1 ? "bg-muted/30" : ""}`}
                    onClick={() => navigate(`/prompt/${prompt.id}`)}
                  >
                    <TableCell className="font-medium text-sm">{prompt.name}</TableCell>
                    <TableCell>
                      <ScoreBadge score={lastRun?.overall_score ?? null} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lastRun
                        ? format(new Date(lastRun.created_date), "MMM d, yyyy")
                        : "Never"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Prompt</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Prompt name"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}