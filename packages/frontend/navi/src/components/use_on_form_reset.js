import { useLayoutEffect } from "preact/hooks";

export const useOnFormReset = (elementRef, onReset) => {
  useLayoutEffect(() => {
    const element = elementRef.current;
    const form = element.form;
    if (!form) {
      return null;
    }
    form.addEventListener("reset", onReset);
    return () => {
      element.removeEventListener("reset", onReset);
    };
  }, [onReset]);
};
