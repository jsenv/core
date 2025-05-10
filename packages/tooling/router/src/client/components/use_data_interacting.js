/**
 * The following html
 *
 * ```html
 * <style>
 *   input:invalid {
 *     outline-color: red;
 *   }
 * </style>
 *
 * <input required>
 * ```
 *
 * Would make input red without user interaction.
 *
 * Here we want to change that for the required validity check:
 *
 * 1. When user don't interact, input:invalid should not be visible
 * 2. When user focus the input, input:invalid should not be visible
 * 3. When user start typing, input:invalid does not match so we're good
 * 4. While typing if user makes input empty, input:invalid matches and should be visible
 *
 * - It's important to keep input:invalid matching and required attribute at all times
 * to ensure form submission is blocked.
 * - We need something to help CSS display :invalid only when condition 4 is met
 *
 * -> We put [data-interacting] when user starts typing and we remove it when input is blurred
 */

import { useLayoutEffect } from "preact/hooks";

export const useDataInteracting = (inputRef) => {
  useLayoutEffect(() => {
    const input = inputRef.current;

    const onfocus = () => {
      input.addEventListener("input", oninput);
    };
    const onblur = () => {
      input.removeAttribute("data-interacting", "");
    };
    const oninput = () => {
      input.removeEventListener("input", oninput);
      input.setAttribute("data-interacting", "");
    };

    input.addEventListener("focus", onfocus);
    input.addEventListener("blur", onblur);

    return () => {
      input.removeEventListener("focus", onfocus);
      input.removeEventListener("blur", onblur);
      input.removeEventListener("input", oninput);
    };
  }, []);
};
