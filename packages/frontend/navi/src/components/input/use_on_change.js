import { useLayoutEffect } from "preact/hooks";

export const useOnChange = (innerRef, callback) => {
  // we must use a custom event listener because preact bind onChange to onInput for compat with react
  useLayoutEffect(() => {
    const input = innerRef.current;
    input.addEventListener("change", callback);
    return () => {
      input.removeEventListener("change", callback);
    };
  }, [callback]);
};
