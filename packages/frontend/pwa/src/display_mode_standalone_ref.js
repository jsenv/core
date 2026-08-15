import { sigref } from "@jsenv/sigi";

const get = () => {
  return (
    window.navigator.standalone ||
    window.matchMedia("(display-mode: standalone)").matches
  );
};
/**
 * Reactive ref telling if the page runs in standalone display mode (launched
 * from the home screen as a PWA rather than inside a browser tab).
 * `displayModeStandaloneRef.value` is a boolean;
 * `displayModeStandaloneRef.subscribe(callback)` calls back immediately and on
 * every change.
 */
const [displayModeStandaloneRef, displayModeStandaloneSetter] = sigref(get());
const media = window.matchMedia("(display-mode: standalone)");
media.addEventListener("change", () => {
  displayModeStandaloneSetter(get());
});

export { displayModeStandaloneRef };
