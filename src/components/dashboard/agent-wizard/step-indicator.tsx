const defaultSteps = ["Basics", "AI Model", "Heartbeat", "Review"];

interface StepIndicatorProps {
  currentStep: number;
  totalSteps?: number;
  steps?: string[];
}

export function StepIndicator({ currentStep, totalSteps, steps }: StepIndicatorProps) {
  const stepLabels = steps || defaultSteps.slice(0, totalSteps || defaultSteps.length);
  
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
      {stepLabels.map((label, i) => (
        <div key={label} className="flex items-center gap-2 sm:gap-3">
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
              className={`text-sm font-medium hidden sm:inline ${
                i <= currentStep
                  ? "text-aura-text-white"
                  : "text-aura-text-dim"
              }`}
            >
              {label}
            </span>
          </div>
          {i < stepLabels.length - 1 && (
            <div
              className={`h-px w-6 sm:w-12 ${
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
