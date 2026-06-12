import { triggerStringAction } from "@jsenv/navi/src/control/string_actions.js";
import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";

export const InputModeResolver = (props) => {
  const Next = useNextResolver();

  if (props.inputMode === "numeric") {
    return <InputModeNumeric {...props} />;
  }
  return <Next {...props} />;
};

const InputModeNumeric = (props) => {
  const Next = useNextResolver();

  const { min, max, step = 1 } = props;
  let maxLength;
  if (max !== undefined) {
    const integerDigits = String(Math.floor(max)).length;
    // If step has decimal places, the value can contain a separator + those digits
    const stepStr = String(step);
    const dotIndex = stepStr.indexOf(".");
    const decimalDigits = dotIndex === -1 ? 0 : stepStr.length - dotIndex - 1;
    // If min is negative (or unknown and max itself is negative), a "-" sign can appear
    const canBeNegative = min !== undefined ? min < 0 : max < 0;
    const signChar = canBeNegative ? 1 : 0;
    maxLength =
      signChar + integerDigits + (decimalDigits > 0 ? 1 + decimalDigits : 0);
  }

  return (
    <Next
      maxLength={maxLength}
      {...props}
      onInput={(e) => {
        props.onInput?.(e);
        if (e.defaultPrevented) {
          return;
        }
        if (maxLength === undefined) {
          return;
        }
        const input = e.currentTarget;
        if (input.value.length < maxLength) {
          return;
        }
        if (input.selectionStart !== maxLength) {
          return;
        }
        // Field is full and caret is at the end: notify listeners then
        // select all so the next keystroke starts a fresh value instead of
        // being silently blocked by maxlength.
        input.dispatchEvent(
          new CustomEvent("navi_input_filled", { bubbles: true }),
        );
        input.select();
      }}
      onKeyDown={(e) => {
        props.onKeyDown?.(e);
        if (e.defaultPrevented) {
          return;
        }
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
          return;
        }
        e.preventDefault();
        const currentValue = Number(e.currentTarget.value);
        if (Number.isNaN(currentValue)) {
          return;
        }
        const delta = e.key === "ArrowUp" ? step : -step;
        // Snap to step grid relative to step base (min ?? 0), then move
        const stepBase = min !== undefined ? min : 0;
        const offset = currentValue - stepBase;
        const currentStepIndex = Math.round(offset / step);
        const snapped = stepBase + currentStepIndex * step;
        let nextValue = snapped + delta;
        if (min !== undefined && nextValue < min) {
          nextValue = min;
        }
        if (max !== undefined && nextValue > max) {
          nextValue = max;
        }
        triggerStringAction("update", nextValue, {
          event: e,
          actionTarget: e.currentTarget,
        });
      }}
    />
  );
};
