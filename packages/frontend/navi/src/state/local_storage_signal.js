import { effect, signal } from "@preact/signals";

import {
  readLocalStorage,
  writeLocalStorage,
} from "./guarded_local_storage.js";

export const localStorageSignal = (key) => {
  const valueSignal = signal(readLocalStorage(key));
  effect(() => {
    const value = valueSignal.value;
    // Storage keeps strings: a null written as is would come back as "null".
    writeLocalStorage(key, value === null ? undefined : value);
  });

  return valueSignal;
};
