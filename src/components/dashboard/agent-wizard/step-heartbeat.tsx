"use client";

import { UseFormReturn } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CreateAgentData } from "@/lib/validators/agent";

const schedules = [
  { value: "*/5 * * * *", label: "Every 5 minutes" },
  { value: "*/15 * * * *", label: "Every 15 minutes" },
  { value: "*/30 * * * *", label: "Every 30 minutes" },
  { value: "0 * * * *", label: "Every hour" },
  { value: "0 */6 * * *", label: "Every 6 hours" },
  { value: "0 9 * * *", label: "Daily at 9 AM" },
  { value: "0 9 * * 1-5", label: "Weekdays at 9 AM" },
];

interface StepHeartbeatProps {
  form: UseFormReturn<CreateAgentData>;
  onBack: () => void;
  onNext: () => void;
}

export function StepHeartbeat({ form, onBack, onNext }: StepHeartbeatProps) {
  const heartbeatEnabled = form.watch("heartbeatEnabled");

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Heartbeat</Label>
            <p className="text-sm text-aura-text-dim">
              Enable a recurring schedule for this agent to check in
              automatically.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={heartbeatEnabled}
            onClick={() =>
              form.setValue("heartbeatEnabled", !heartbeatEnabled)
            }
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              heartbeatEnabled ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                heartbeatEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {heartbeatEnabled && (
          <div className="space-y-2">
            <Label>Schedule</Label>
            <Select
              value={form.watch("heartbeatCron") ?? ""}
              onValueChange={(value) => form.setValue("heartbeatCron", value)}
            >
              <SelectTrigger className="bg-aura-surface">
                <SelectValue placeholder="Select a schedule" />
              </SelectTrigger>
              <SelectContent>
                {schedules.map((schedule) => (
                  <SelectItem key={schedule.value} value={schedule.value}>
                    {schedule.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}
