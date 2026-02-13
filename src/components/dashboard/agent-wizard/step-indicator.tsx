const steps = ["Basics", "Heartbeat", "Review"];

interface StepIndicatorProps {
  currentStep: number;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                i <= currentStep
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-sm font-medium ${
                i <= currentStep
                  ? "text-aura-text-white"
                  : "text-aura-text-dim"
              }`}
            >
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-px w-12 ${
                i < currentStep
                  ? "bg-primary"
                  : "bg-[rgba(255,255,255,0.05)]"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
