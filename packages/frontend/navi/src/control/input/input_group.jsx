import { useEffect, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";

/**
 * Wraps multiple inputs together and handles keyboard navigation between them.
 * ArrowRight at the end of an input moves focus to the next input.
 * ArrowLeft at the start of an input moves focus to the previous input.
 * navi_input_full (emitted when an input reaches maxLength) also moves forward.
 */
export const InputGroup = (props) => {
  const ref = useRef(null);
  useInputGroup(ref);

  return <Box ref={ref} {...props} />;
};

const useInputGroup = (ref) => {
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
        const atEnd =
          active.selectionStart === active.value.length &&
          active.selectionEnd === active.value.length;
        if (!atEnd) {
          return;
        }
        const inputs = getInputs();
        const idx = inputs.indexOf(active);
        if (idx !== -1 && idx < inputs.length - 1) {
          e.preventDefault();
          focusInput(inputs[idx + 1]);
        }
      } else {
        const atStart =
          active.selectionStart === 0 && active.selectionEnd === 0;
        if (!atStart) {
          return;
        }
        const inputs = getInputs();
        const idx = inputs.indexOf(active);
        if (idx > 0) {
          e.preventDefault();
          focusInput(inputs[idx - 1]);
        }
      }
    };

    const handleNaviInputFull = (e) => {
      const input = e.target.closest(".navi_control_input");
      if (!input || !el.contains(input)) {
        return;
      }
      const inputs = getInputs();
      const idx = inputs.indexOf(input);
      if (idx !== -1 && idx < inputs.length - 1) {
        focusInput(inputs[idx + 1]);
      }
    };

    el.addEventListener("keydown", handleKeyDown, { capture: false });
    el.addEventListener("navi_input_full", handleNaviInputFull);
    return () => {
      el.removeEventListener("keydown", handleKeyDown, { capture: false });
      el.removeEventListener("navi_input_full", handleNaviInputFull);
    };
  }, []);
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
