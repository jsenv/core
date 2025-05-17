import { useLayoutEffect } from "preact/hooks";

// see https://github.com/preactjs/preact/issues/1034#issuecomment-2857877043
export const useRequestSubmitOnChange = (
  inputRef,
  { preventWhenValueMissing } = {},
) => {
  useLayoutEffect(() => {
    const input = inputRef.current;
    const onChange = () => {
      if (preventWhenValueMissing && input.validity.valueMissing) {
        // it would display the message twice, see https://codepen.io/dmail/pen/dPPwvGW
        return;
      }
      const submitter = input;
      const form = submitter.form;
      // do not pass submitter to requestSubmit() because we can't pass any submitter
      // for instance browser would throw
      // Failed to execute 'requestSubmit' on 'HTMLFormElement': The specified element is not a submit button.
      // if we pass <input type="text">
      form.requestSubmit();
    };
    input.addEventListener("change", onChange);
    return () => {
      input.removeEventListener("change", onChange);
    };
  }, [preventWhenValueMissing]);
};
