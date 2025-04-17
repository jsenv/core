// https://developer.mozilla.org/en-US/docs/Web/API/UserActivation

import { signal } from "@preact/signals";

const { userActivation } = window.navigator;
const getUserActivationState = () => {
  if (userActivation.isActive) {
    return "active";
  }
  if (userActivation.hasBeenActive) {
    return "hasBeenActive";
  }
  return "inactive";
};

const updateState = () => {
  userActivationSignal.value = getUserActivationState();
};

export const userActivationSignal = signal(getUserActivationState());

if (userActivationSignal.peek() === "inactive") {
  const onmousedown = (mousedownEvent) => {
    if (!mousedownEvent.isTrusted) {
      return;
    }
    updateState();
    if (userActivationSignal.peek() !== "inactive") {
      document.removeEventListener("mousedown", onmousedown, { capture: true });
      document.removeEventListener("keydown", onkeydown, { capture: true });
    }
  };
  const onkeydown = (keydownEvent) => {
    if (!keydownEvent.isTrusted) {
      return;
    }
    updateState();
    if (userActivationSignal.peek() !== "inactive") {
      document.removeEventListener("mousedown", onmousedown, { capture: true });
      document.removeEventListener("keydown", onkeydown, { capture: true });
    }
  };
  document.addEventListener("mousedown", onmousedown, { capture: true });
  document.addEventListener("keydown", onkeydown, { capture: true });
}
