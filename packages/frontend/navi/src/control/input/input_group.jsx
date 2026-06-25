import { useEffect, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { dispatchRequestInteraction } from "@jsenv/navi/src/control/rules/control_interaction.js";
import { dispatchRequestSetUIState } from "@jsenv/navi/src/control/ui_state_dom.js";
import { useDebugFocus } from "@jsenv/navi/src/navi_debug.jsx";

/**
 * Wraps multiple inputs together and handles keyboard navigation and paste
 * distribution between them.
 *
 * Keyboard navigation:
 *   ArrowRight at the end of an input moves focus to the next input.
 *   ArrowLeft at the start of an input moves focus to the previous input.
 *   navi_input_full (emitted when an input reaches maxLength) also moves forward.
 *
 * Paste distribution:
 *   When an input has a data-separator attribute, pasting a string that
 *   contains that separator (e.g. "27/04/1990" into a day input with
 *   data-separator="/") splits the text on each separator and fills the
 *   corresponding sub-inputs in order.
 */
export const InputGroup = (props) => {
  const ref = useRef(null);
  useInputGroup(ref);

  return <Box ref={ref} {...props} />;
};

const useInputGroup = (ref) => {
  const debugFocus = useDebugFocus();

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return () => {};
    }

    const getInputs = () =>
      Array.from(el.querySelectorAll(".navi_control_input"));

    const focusInput = (input) => {
      input.focus();
      input.select();
    };

    const handleKeyDown = (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") {
        return;
      }
      const active = document.activeElement;
      if (!isTextInputElement(active) || !el.contains(active)) {
        return;
      }
      if (e.key === "ArrowRight") {
        const allSelected =
          active.selectionStart === 0 &&
          active.selectionEnd === active.value.length;
        const atEnd =
          allSelected ||
          (active.selectionStart === active.value.length &&
            active.selectionEnd === active.value.length);
        if (!atEnd) {
          return;
        }
        const inputs = getInputs();
        const idx = inputs.indexOf(active);
        if (idx === -1) {
          debugFocus(
            e,
            "InputGroup ArrowRight on non group input → do nothing",
          );
          return;
        }
        if (idx === inputs.length - 1) {
          debugFocus(
            e,
            "InputGroup ArrowRight at end of last input → do nothing",
          );
          return;
        }

        debugFocus(
          e,
          "InputGroup ArrowRight at end of input[%d] → focus input[%d]",
          idx,
          idx + 1,
        );
        e.preventDefault();
        focusInput(inputs[idx + 1]);
        return;
      }
      const allSelected =
        active.selectionStart === 0 &&
        active.selectionEnd === active.value.length;
      const atStart =
        allSelected ||
        (active.selectionStart === 0 && active.selectionEnd === 0);
      if (!atStart) {
        return;
      }
      const inputs = getInputs();
      const idx = inputs.indexOf(active);
      if (idx === 0) {
        return;
      }
      debugFocus(
        e,
        "InputGroup ArrowLeft at start of input[%d] → focus input[%d]",
        idx,
        idx - 1,
      );
      e.preventDefault();
      focusInput(inputs[idx - 1]);
    };

    const handleNaviInputFull = (e) => {
      const input = e.detail.event.currentTarget;
      if (!el.contains(input)) {
        return;
      }
      const inputs = getInputs();
      const idx = inputs.indexOf(input);
      if (idx === -1) {
        return;
      }
      if (idx === inputs.length - 1) {
        return;
      }
      const nextInput = inputs[idx + 1];
      debugFocus(
        e,
        "InputGroup navi_input_full on input -> move to next input",
        input,
        nextInput,
      );
      e.preventDefault();
      focusInput(nextInput);
    };

    const handlePaste = (e) => {
      const active = document.activeElement;
      if (!isTextInputElement(active) || !el.contains(active)) {
        return;
      }
      const inputs = getInputs();
      const startIdx = inputs.indexOf(active);
      if (startIdx === -1) {
        return;
      }
      const pastedText = e.clipboardData?.getData("text") ?? "";
      if (!pastedText) {
        return;
      }
      // Only intercept when the pasted text contains at least one separator
      // from the inputs starting at the focused position.
      const remainingInputs = inputs.slice(startIdx);
      const hasSeparatorMatch = remainingInputs.some(
        (input) =>
          input.dataset.separator &&
          pastedText.includes(input.dataset.separator),
      );
      if (!hasSeparatorMatch) {
        return;
      }
      e.preventDefault();
      let remaining = pastedText;
      let lastFilledIdx = startIdx;
      for (let i = 0; i < remainingInputs.length; i++) {
        const input = remainingInputs[i];
        const separator = input.dataset.separator;
        let part;
        if (separator && remaining.includes(separator)) {
          const sepIdx = remaining.indexOf(separator);
          part = remaining.slice(0, sepIdx);
          remaining = remaining.slice(sepIdx + separator.length);
        } else {
          part = remaining;
          remaining = "";
        }
        requestSubPaste(input, part, e);
        lastFilledIdx = startIdx + i;
        if (remaining === "") {
          break;
        }
      }
      focusInput(inputs[lastFilledIdx]);
    };

    el.addEventListener("keydown", handleKeyDown, { capture: true });
    el.addEventListener("navi_input_full", handleNaviInputFull);
    el.addEventListener("paste", handlePaste, { capture: true });
    return () => {
      el.removeEventListener("keydown", handleKeyDown, { capture: true });
      el.removeEventListener("navi_input_full", handleNaviInputFull);
      el.removeEventListener("paste", handlePaste, { capture: true });
    };
  }, [debugFocus]);
};

const requestSubPaste = (input, value, event) => {
  dispatchRequestInteraction(input, {
    event,
    name: "subpaste",
    allowed: () => {
      dispatchRequestSetUIState(input, value, { event });
    },
  });
};

const isTextInputElement = (el) => {
  if (!el) {
    return false;
  }
  if (el.tagName === "TEXTAREA") {
    return true;
  }
  if (el.tagName !== "INPUT") {
    return false;
  }
  const type = el.type || "text";
  return (
    type === "text" ||
    type === "search" ||
    type === "url" ||
    type === "tel" ||
    type === "email" ||
    type === "password" ||
    type === "number"
  );
};
