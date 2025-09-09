import { useLayoutEffect, useRef } from "preact/hooks";

export const useOnChange = (inputRef, callback) => {
  // we must use a custom event listener because preact bind onChange to onInput for compat with react
  useLayoutEffect(() => {
    const input = inputRef.current;
    input.addEventListener("change", callback);
    return () => {
      input.removeEventListener("change", callback);
    };
  }, [callback]);

  // Handle programmatic value changes that don't trigger browser change events
  //
  // Problem: When input values are set programmatically (not by user typing),
  // browsers don't fire the 'change' event. However, our application logic
  // still needs to detect these changes.
  //
  // Example scenario:
  // 1. User starts editing (letter key pressed, value set programmatically)
  // 2. User doesn't type anything additional (this is the key part)
  // 3. User clicks outside to finish editing
  // 4. Without this code, no change event would fire despite the fact that the input value did change from its original state
  //
  // This distinction is crucial because:
  //
  // - If the user typed additional text after the initial programmatic value,
  //   the browser would fire change events normally
  // - But when they don't type anything else, the browser considers it as "no user interaction"
  //   even though the programmatic initial value represents a meaningful change
  const valueAtStartRef = useRef();
  const interactedRef = useRef(false);
  useLayoutEffect(() => {
    const input = inputRef.current;
    valueAtStartRef.current = input.value;

    const onfocus = () => {
      interactedRef.current = false;
      valueAtStartRef.current = input.value;
    };
    const oninput = (e) => {
      if (e.isTrusted) {
        interactedRef.current = true;
      }
    };
    const onblur = (e) => {
      if (!interactedRef.current && valueAtStartRef.current !== input.value) {
        callback(e);
      }
    };

    input.addEventListener("focus", onfocus);
    input.addEventListener("input", oninput);
    input.addEventListener("blur", onblur);

    return () => {
      input.removeEventListener("focus", onfocus);
      input.removeEventListener("input", oninput);
      input.removeEventListener("blur", onblur);
    };
  }, []);
};
