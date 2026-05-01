import { signal } from "@preact/signals";

export const windowWidthSignal = signal(window.innerWidth);

window.addEventListener("resize", () => {
  windowWidthSignal.value = window.innerWidth;
});
