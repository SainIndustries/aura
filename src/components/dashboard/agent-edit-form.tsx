"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAgentSchema, type CreateAgentData } from "@/lib/validators/agent";
import { updateAgent } from "@/app/(dashboard)/agents/actions";

const schedules = [
  { value: "*/5 * * * *", label: "Every 5 minutes" },
  { value: "*/15 * * * *", label: "Every 15 minutes" },
  { value: "*/30 * * * *", label: "Every 30 minutes" },
  { value: "0 * * * *", label: "Every hour" },
  { value: "0 */6 * * *", label: "Every 6 hours" },
  { value: "0 9 * * *", label: "Daily at 9 AM" },
  { value: "0 9 * * 1-5", label: "Weekdays at 9 AM" },
];

interface AgentEditFormProps {
  agentId: string;
  defaultValues: CreateAgentData;
}

export function AgentEditForm({ agentId, defaultValues }: AgentEditFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateAgentData>({
    resolver: zodResolver(createAgentSchema),
    defaultValues,
  });

  const heartbeatEnabled = watch("heartbeatEnabled");

  const onSubmit = async (data: CreateAgentData) => {
    await updateAgent(agentId, data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Agent Name *</Label>
        <Input
          id="name"
          {...register("name")}
          className="bg-aura-surface"
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={3}
          {...register("description")}
          className="bg-aura-surface"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="personality">Personality</Label>
        <Textarea
          id="personality"
          rows={3}
          {...register("personality")}
          className="bg-aura-surface"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="goal">Goal</Label>
        <Textarea
          id="goal"
          rows={3}
          {...register("goal")}
          className="bg-aura-surface"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label>Heartbeat</Label>
            <p className="text-sm text-aura-text-dim">
              Recurring schedule for automatic check-ins
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={heartbeatEnabled}
            onClick={() => setValue("heartbeatEnabled", !heartbeatEnabled)}
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
              value={watch("heartbeatCron") ?? ""}
              onValueChange={(value) => setValue("heartbeatCron", value)}
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

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
