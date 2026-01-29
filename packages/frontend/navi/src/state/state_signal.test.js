import { snapshotTests } from "@jsenv/snapshot";
import { signal } from "@preact/signals";
import { stateSignal } from "./state_signal.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basics", () => {
    const sig = stateSignal(undefined);

    const valueAtStart = sig.value;
    sig.value = "explicit";
    const valueAfterSet = sig.value;
    sig.value = undefined;
    const valueAfterReset = sig.value;

    return {
      valueAtStart,
      valueAfterSet,
      valueAfterReset,
    };
  });

  test("1_with_static_default_value", () => {
    const sig = stateSignal(42);

    const valueAtStart = sig.value;
    sig.value = "explicit";
    const valueAfterSet = sig.value;
    sig.value = undefined;
    const valueAfterReset = sig.value;

    return {
      valueAtStart,
      valueAfterSet,
      valueAfterReset,
    };
  });

  test("2_with_dynamic_default_value", () => {
    const dynamicDefault = signal("default_at_start");
    const sig = stateSignal(dynamicDefault);

    const valueAtStart = sig.value;
    dynamicDefault.value = "default_updated";
    const valueAfterUpdateDefault = sig.value;
    sig.value = "explicit";
    const valueAfterUpdate = sig.value;
    dynamicDefault.value = "default_updated_again";
    const valueAfterSecondUpdateDefault = sig.value;

    return {
      valueAtStart,
      valueAfterUpdateDefault,
      valueAfterUpdate,
      valueAfterSecondUpdateDefault,
    };
  });
});
