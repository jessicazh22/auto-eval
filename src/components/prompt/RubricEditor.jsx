import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Trash2, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import debounce from "lodash/debounce";

export default function RubricEditor({ rubric, criteria, onCriteriaChange }) {
  const queryClient = useQueryClient();
  const [localCriteria, setLocalCriteria] = useState(criteria);
  const [threshold, setThreshold] = useState(rubric?.passing_threshold ?? 70);

  useEffect(() => {
    setLocalCriteria(criteria);
  }, [criteria]);

  useEffect(() => {
    setThreshold(rubric?.passing_threshold ?? 70);
  }, [rubric]);

  const totalWeight = localCriteria.reduce((sum, c) => sum + (c.weight || 0), 0);

  const effectiveWeight = (w) => {
    if (totalWeight === 0) return 0;
    return Math.round(((w || 0) / totalWeight) * 100);
  };

  const debouncedSaveCriterion = useCallback(
    debounce(async (id, data) => {
      await base44.entities.RubricCriterion.update(id, data);
      onCriteriaChange();
    }, 800),
    []
  );

  const debouncedSaveThreshold = useCallback(
    debounce(async (rubricId, value) => {
      await base44.entities.Rubric.update(rubricId, { passing_threshold: value });
    }, 800),
    []
  );

  const updateCriterion = (index, field, value) => {
    const updated = [...localCriteria];
    updated[index] = { ...updated[index], [field]: value };
    setLocalCriteria(updated);
    debouncedSaveCriterion(updated[index].id, { [field]: value });
  };

  const addCriterion = async () => {
    await base44.entities.RubricCriterion.create({
      rubric_id: rubric.id,
      name: "New Criterion",
      description: "Describe what to evaluate",
      weight: 0.5,
    });
    onCriteriaChange();
  };

  const deleteCriterion = async (id) => {
    await base44.entities.RubricCriterion.delete(id);
    onCriteriaChange();
  };

  const handleThresholdChange = (value) => {
    setThreshold(value);
    debouncedSaveThreshold(rubric.id, value);
  };

  return (
    <div className="space-y-4">
      {localCriteria.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">No criteria yet. Add one to define your rubric.</p>
      )}

      <div className="space-y-3">
        {localCriteria.map((criterion, i) => (
          <div key={criterion.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
            <div className="flex-1 space-y-2">
              <Input
                value={criterion.name}
                onChange={(e) => updateCriterion(i, "name", e.target.value)}
                placeholder="Criterion name"
                className="font-medium text-sm h-8"
              />
              <Textarea
                value={criterion.description}
                onChange={(e) => updateCriterion(i, "description", e.target.value)}
                placeholder="What does this criterion evaluate?"
                className="text-sm text-muted-foreground resize-none min-h-[72px]"
              />
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-12 shrink-0">Weight</span>
                <Slider
                  value={[criterion.weight || 0]}
                  onValueChange={([v]) => updateCriterion(i, "weight", v)}
                  min={0}
                  max={1}
                  step={0.05}
                  className="flex-1"
                />
                <span className="text-xs font-mono text-muted-foreground w-10 text-right">
                  {(criterion.weight || 0).toFixed(2)}
                </span>
                <span className="text-xs font-medium text-foreground w-10 text-right">
                  {effectiveWeight(criterion.weight)}%
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-destructive h-8 w-8"
              onClick={() => deleteCriterion(criterion.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addCriterion} className="gap-1.5">
        <Plus className="w-3.5 h-3.5" />
        Add Criterion
      </Button>

      <div className="flex items-center gap-3 pt-3 border-t">
        <span className="text-sm text-muted-foreground">Passing threshold</span>
        <Input
          type="number"
          min={0}
          max={100}
          value={threshold}
          onChange={(e) => handleThresholdChange(Number(e.target.value))}
          className="w-20 h-8 text-sm"
        />
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}