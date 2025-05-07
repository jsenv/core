import { useLayoutEffect } from "preact/hooks";

// see https://github.com/preactjs/preact/issues/1034#issuecomment-2857877043
export const useRequestSubmitOnChange = (inputRef) => {
  useLayoutEffect(() => {
    const onChange = (e) => {
      const submitter = e.target;
      const form = submitter.form;
      // do not pass submitter to requestSubmit() because we can't pass any submitter
      // for instance browser would throw
      // Failed to execute 'requestSubmit' on 'HTMLFormElement': The specified element is not a submit button.
      // if we pass <input type="text">
      form.requestSubmit();
    };
    inputRef.current.addEventListener("change", onChange);
    return () => {
      inputRef.current.removeEventListener("change", onChange);
    };
  }, []);
};
