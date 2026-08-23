import { cx } from "@/lib/utilities/cx";

export type StepState = "complete" | "current" | "upcoming" | "error" | "disabled";

export type StepItem = {
  id: string;
  label: string;
  description?: string;
  state: StepState;
};

export function Stepper({
  steps,
  orientation = "horizontal",
  onStepSelect,
}: {
  steps: StepItem[];
  orientation?: "horizontal" | "vertical";
  onStepSelect?: (id: string) => void;
}) {
  const current = steps.find((step) => step.state === "current");

  return (
    <ol
      className={cx("ds-stepper", orientation === "vertical" && "ds-stepper--vertical")}
      aria-label="مراحل"
    >
      {steps.map((step, index) => {
        const clickable = step.state === "complete" && onStepSelect;
        const content = (
          <>
            <span className="ds-step__index" aria-hidden="true">
              {index + 1}
            </span>
            <span>
              <strong>{step.label}</strong>
              {step.description ? <p className="ds-help">{step.description}</p> : null}
            </span>
          </>
        );

        return (
          <li
            key={step.id}
            className="ds-step"
            data-state={step.state}
            aria-current={step.state === "current" ? "step" : undefined}
          >
            {clickable ? (
              <button type="button" className="ds-inline" onClick={() => onStepSelect(step.id)}>
                {content}
              </button>
            ) : (
              <div className="ds-inline">{content}</div>
            )}
          </li>
        );
      })}
      {current ? (
        <span className="visually-hidden">مرحله جاری: {current.label}</span>
      ) : null}
    </ol>
  );
}
