import { dispatchPublicCustomEvent } from "@jsenv/dom";
import { dispatchRequestInteraction } from "@jsenv/navi/src/control/rules/control_interaction.js";
import { dispatchRequestSetUIState } from "@jsenv/navi/src/control/ui_state_dom.js";
import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { useRef } from "preact/hooks";

export const InputModeResolver = (props) => {
  const Next = useNextResolver();

  if (props.inputMode === "numeric" || props.inputMode === "decimal") {
    return <InputModeNumericOrDecimal {...props} />;
  }
  return <Next {...props} />;
};

const InputModeNumericOrDecimal = (props) => {
  const Next = useNextResolver();
  // Where a finger landed, to tell a tap that placed the caret from a drag that
  // selected a part of the number (see onPointerUp below).
  const pointerDownRef = useRef(null);

  return (
    <Next
      {...props}
      // A field with no room for one more digit is a field one can only
      // REPLACE: typing into it does nothing at all, so taking the caret
      // selects what is there and the first digit typed starts a new number.
      // The same handover navi_input_full does once a field fills up, asked at
      // the other end — when the field is entered rather than when it is
      // filled.
      onFocus={(e) => {
        props.onFocus?.(e);
        if (e.defaultPrevented) {
          return;
        }
        selectIfFull(e.currentTarget);
      }}
      onPointerDown={(e) => {
        props.onPointerDown?.(e);
        pointerDownRef.current = { x: e.clientX, y: e.clientY };
      }}
      // Once more on release, for a finger: a phone places the caret where it
      // was tapped AFTER the focus above, which undoes the selection made
      // there — and a field one cannot type into is then back to being a field
      // one cannot type into. Not for a mouse, which is how one selects a
      // single digit by dragging across it; and not for a finger that
      // travelled, which was scrolling the page rather than aiming at the
      // number.
      onPointerUp={(e) => {
        props.onPointerUp?.(e);
        if (e.defaultPrevented) {
          return;
        }
        if (e.pointerType !== "touch") {
          return;
        }
        const pointerDown = pointerDownRef.current;
        if (pointerDown) {
          const dx = e.clientX - pointerDown.x;
          const dy = e.clientY - pointerDown.y;
          if (dx * dx + dy * dy > TAP_SLOP * TAP_SLOP) {
            return;
          }
        }
        selectIfFull(e.currentTarget);
      }}
      onInput={(e) => {
        props.onInput?.(e);
        if (e.defaultPrevented) {
          return;
        }
        const input = e.currentTarget;
        const caretAtEnd = input.selectionStart === input.value.length;
        if (!caretAtEnd) {
          return;
        }
        if (!isFull(input, readMaxLength(input))) {
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

// How far a finger may travel and still be aiming at what it landed on, in
// pixels: past that it was scrolling the page.
const TAP_SLOP = 10;

// Everything already in the field, selected — but only when nothing more can be
// typed after it, which is when replacing is the only edit left. A field one is
// merely half-way through filling keeps its caret where it was put.
const selectIfFull = (input) => {
  if (input.readOnly || input.disabled) {
    return;
  }
  if (!isFull(input, readMaxLength(input))) {
    return;
  }
  if (input.selectionStart === 0 && input.selectionEnd === input.value.length) {
    return;
  }
  input.select();
};

// What the field accepts at most: our own attribute first, since the native
// maxLength is deliberately left unset (see RealInput in input_textual.jsx).
const readMaxLength = (input) => {
  const maxLength = input.maxLength;
  if (maxLength !== -1) {
    return maxLength;
  }
  const naviMaxLengthAttr = input.getAttribute("navi-max-length");
  return naviMaxLengthAttr === null ? undefined : Number(naviMaxLengthAttr);
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
