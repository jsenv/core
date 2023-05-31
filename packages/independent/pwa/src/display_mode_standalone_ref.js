/**
 * displayModeStandalone can be used to know the current displayMode of
 * our web page is standalone (PWA)
 */

import { sigref } from "@jsenv/sigi";

const get = () => {
  return (
    window.navigator.standalone ||
    window.matchMedia("(display-mode: standalone)").matches
  );
};
const [displayModeStandaloneRef, displayModeStandaloneSetter] = sigref(get());
const media = window.matchMedia("(display-mode: standalone)");
media.addEventListener("change", () => {
  displayModeStandaloneSetter(get());
});

export { displayModeStandaloneRef };
