import { dispatchPublicCustomEvent } from "@jsenv/dom";
import { dispatchRequestInteraction } from "@jsenv/navi/src/control/rules/control_interaction.js";
import { dispatchRequestSetUIState } from "@jsenv/navi/src/control/ui_state_dom.js";
import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";

export const InputModeResolver = (props) => {
  const Next = useNextResolver();

  if (props.inputMode === "numeric" || props.inputMode === "decimal") {
    return <InputModeNumericOrDecimal {...props} />;
  }
  return <Next {...props} />;
};

const InputModeNumericOrDecimal = (props) => {
  const Next = useNextResolver();

  return (
    <Next
      {...props}
      onInput={(e) => {
        props.onInput?.(e);
        if (e.defaultPrevented) {
          return;
        }
        const input = e.currentTarget;
        let maxLength = input.maxLength;
        if (maxLength === -1) {
          const naviMaxLengthAttr = input.getAttribute("navi-max-length");
          maxLength =
            naviMaxLengthAttr === null ? undefined : Number(naviMaxLengthAttr);
        }
        const caretAtEnd = input.selectionStart === input.value.length;
        if (!caretAtEnd) {
          return;
        }
        if (!isFull(input, maxLength)) {
          return;
        }
        // Field is full and caret is at the end: notify listeners then
        // select all so the next keystroke starts a fresh value instead of
        // being silently blocked by maxlength.
        const allowed = dispatchPublicCustomEvent(input, "navi_input_full", {
          event: e,
        });
        // Only for a value being typed: selecting focuses the field, and a
        // value set from elsewhere (a chevron, a form) has nobody typing — on a
        // phone that focus raises the on-screen keyboard over the page. Same
        // question useInputGroup asks before moving along to the next field.
        if (allowed && e.isTrusted) {
          input.select();
        } else {
          // e.preventDefault();
          // navi_input_full called preventDefault()
          // (it consumed the event likely meaning an other input got focused)
        }
      }}
      onKeyDown={(e) => {
        props.onKeyDown?.(e);
        if (e.defaultPrevented) {
          return;
        }
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          performArrowUpDown(e);
          return;
        }
      }}
    />
  );
};

// A field is full when there is no room for another digit — and room is not
// only a number of characters: an hour of two digits at most is also full at
// "7", because 7 followed by anything is past the 23 it accepts. Both are the
// same question ("can one more digit still land here?"), so both move the
// person filling it in along to the next field.
const isFull = (input, maxLength) => {
  const value = input.value;
  if (value === "") {
    return false;
  }
  if (maxLength !== undefined && value.length >= maxLength) {
    return true;
  }
  const max = input.max === "" ? undefined : Number(input.max);
  if (max === undefined || Number.isNaN(max)) {
    return false;
  }
  // The smallest number one more digit could make: a zero appended to what is
  // already there.
  const withOneMoreDigit = Number(`${value}0`);
  if (Number.isNaN(withOneMoreDigit)) {
    return false;
  }
  return withOneMoreDigit > max;
};

// hum il manque le faire de request interaction ici
const performArrowUpDown = (e) => {
  const input = e.currentTarget;
  const currentValue = Number(input.value);
  if (Number.isNaN(currentValue)) {
    e.preventDefault();
    return;
  }
  const min = input.min !== "" ? Number(input.min) : undefined;
  const max = input.max !== "" ? Number(input.max) : undefined;
  const step =
    input.step !== "" && input.step !== "any" ? Number(input.step) : 1;
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
  dispatchRequestInteraction(input, {
    event: e,
    name: "--navi-arrow-up-down",
    prevented: () => e.preventDefault(),
    allowed: () => {
      dispatchRequestSetUIState(input, nextValue, { event: e });
      e.preventDefault();
    },
  });
};
