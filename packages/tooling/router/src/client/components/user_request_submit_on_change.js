import { useLayoutEffect } from "preact/hooks";

// see https://github.com/preactjs/preact/issues/1034#issuecomment-2857877043
export const useRequestSubmitOnChange = (inputRef) => {
  useLayoutEffect(() => {
    const onChange = (e) => {
      const form = e.target.form;
      form.requestSubmit();
    };
    inputRef.current.addEventListener("change", onChange);
    return () => {
      inputRef.current.removeEventListener("change", onChange);
    };
  }, []);
};
