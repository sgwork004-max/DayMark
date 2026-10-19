import { AlertCircle, X } from "lucide-react";
import type { CarryoverInsight } from "@daymark/core";

interface Props {
  insights: CarryoverInsight[];
  onClose: () => void;
}

export function CarryoverInsights({ insights, onClose }: Props) {
  return (
    <div className="carryover-popover">
      <header><AlertCircle size={15} /><strong>Repeated work</strong><button onClick={onClose} aria-label="Close"><X size={14} /></button></header>
      <p>These tasks have appeared on at least three days. Finish, schedule, or consciously drop them.</p>
      <div className="carryover-list">
        {insights.map((item) => (
          <div key={item.content}><span>{item.content}</span><small>{item.occurrences + 1} days</small></div>
        ))}
      </div>
    </div>
  );
}
