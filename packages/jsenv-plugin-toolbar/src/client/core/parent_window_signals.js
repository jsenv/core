import { signal } from "@preact/signals";

import {
  paramsFromParentWindow,
  parentWindowReloader,
} from "./parent_window_context.js";

export const autoreloadEnabledSignal = signal(false);
export const reloaderStatusSignal = signal("idle");
export const changesSignal = signal(0);

if (parentWindowReloader) {
  if (
    !parentWindowReloader.autoreload.enabled &&
    paramsFromParentWindow.autoreload
  ) {
    autoreloadEnabledSignal.value = true;
  } else {
    autoreloadEnabledSignal.value = parentWindowReloader.autoreload.enabled;
  }
  parentWindowReloader.autoreload.onchange = () => {
    autoreloadEnabledSignal.value = parentWindowReloader.autoreload.enabled;
  };
  reloaderStatusSignal.value = parentWindowReloader.status.value;
  const onchange = parentWindowReloader.status.onchange;
  parentWindowReloader.status.onchange = () => {
    onchange();
    reloaderStatusSignal.value = parentWindowReloader.status.value;
  };
  changesSignal.value = parentWindowReloader.changes.value;
  parentWindowReloader.changes.onchange = () => {
    changesSignal.value = [...parentWindowReloader.changes.value];
  };
}
