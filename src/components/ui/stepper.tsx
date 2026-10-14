import { cx } from "@/lib/utilities/cx";

export type StepState = "complete" | "current" | "upcoming" | "error" | "disabled";

export type StepItem = {
  id: string;
  label: string;
  description?: string;
  state: StepState;
};

const STATE_TEXT: Partial<Record<StepState, string>> = {
  complete: "تکمیل‌شده",
  error: "نیازمند اصلاح",
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
    <>
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
                {STATE_TEXT[step.state] ? (
                  <span className="visually-hidden">، {STATE_TEXT[step.state]}</span>
                ) : null}
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
      </ol>
      {current ? (
        <p className="visually-hidden">
          مرحله {steps.indexOf(current) + 1} از {steps.length}: {current.label}
        </p>
      ) : null}
    </>
  );
}
