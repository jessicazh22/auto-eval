import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";

export default function GeneratedRubricEditor({ criteria, onChange }) {
  const totalWeight = criteria.reduce((s, c) => s + (c.weight || 0), 0);

  const update = (index, field, value) => {
    const updated = criteria.map((c, i) => i === index ? { ...c, [field]: value } : c);
    onChange(updated);
  };

  const remove = (index) => {
    onChange(criteria.filter((_, i) => i !== index));
  };

  const add = () => {
    const remaining = Math.max(0, 1 - totalWeight);
    onChange([...criteria, { name: "", description: "", weight: Math.round(remaining * 100) / 100 }]);
  };

  return (
    <div className="space-y-3">
      {criteria.map((c, i) => (
        <div key={i} className="border border-border rounded-lg p-4 space-y-3 bg-card">
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-2">
              <Input
                value={c.name}
                onChange={(e) => update(i, "name", e.target.value)}
                placeholder="Criterion name"
                className="font-medium text-sm h-8"
              />
              <Textarea
                value={c.description}
                onChange={(e) => update(i, "description", e.target.value)}
                placeholder="What does this criterion evaluate?"
                className="text-sm resize-none min-h-[60px]"
              />
            </div>
            <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive transition-colors mt-1 shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Weight:</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={c.weight}
              onChange={(e) => update(i, "weight", parseFloat(e.target.value) || 0)}
              className="w-20 h-7 text-xs border border-input rounded-md px-2 bg-background"
            />
            <span className="text-xs text-muted-foreground">
              ({Math.round((c.weight || 0) * 100)}%)
            </span>
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add criterion
        </Button>
        <span className={`text-xs font-medium ${Math.abs(totalWeight - 1) > 0.01 ? "text-destructive" : "text-muted-foreground"}`}>
          Total weight: {Math.round(totalWeight * 100)}%
          {Math.abs(totalWeight - 1) > 0.01 && " (must equal 100%)"}
        </span>
      </div>
    </div>
  );
}