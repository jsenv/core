import { signal } from "@preact/signals";

const get = () => {
  return (
    window.navigator.standalone ||
    window.matchMedia("(display-mode: standalone)").matches
  );
};
/**
 * Reactive signal telling if the page runs in standalone display mode (launched
 * from the home screen as a PWA rather than inside a browser tab).
 * `displayModeStandaloneSignal.value` is a boolean;
 * `displayModeStandaloneSignal.subscribe(callback)` calls back immediately and
 * on every change.
 */
export const displayModeStandaloneSignal = signal(get());

const media = window.matchMedia("(display-mode: standalone)");
media.addEventListener("change", () => {
  displayModeStandaloneSignal.value = get();
});
