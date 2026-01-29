import { snapshotTests } from "@jsenv/snapshot";
import { signal } from "@preact/signals";
import { globalSignalRegistry, stateSignal } from "./state_signal.js";

// Clear signal registry before each test
const clearSignalRegistry = () => {
  globalSignalRegistry.clear();
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basics", () => {
    clearSignalRegistry();
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
    clearSignalRegistry();
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
    clearSignalRegistry();
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

  test("3_dynamic_default_reset_behavior", () => {
    clearSignalRegistry();
    const dynamicDefault = signal("initial");
    const sig = stateSignal(dynamicDefault);

    // Set explicit value
    sig.value = "explicit";
    dynamicDefault.value = "changed_while_explicit";
    const valueWhileExplicit = sig.value;

    // Reset to undefined - should resume following dynamic default
    sig.value = undefined;
    const valueAfterReset = sig.value;

    // Change dynamic default again - should be followed
    dynamicDefault.value = "followed_again";
    const valueAfterDynamicChange = sig.value;

    return {
      valueWhileExplicit,
      valueAfterReset,
      valueAfterDynamicChange,
    };
  });

  test("4_validation_with_oneOf", () => {
    clearSignalRegistry();
    const sig = stateSignal("option1", {
      id: "validated",
      oneOf: ["option1", "option2", "option3"],
    });

    const initialValid = sig.validity.valid;
    sig.value = "option2";
    const stillValid = sig.validity.valid;
    sig.value = "invalid_option";
    const nowInvalid = sig.validity.valid;

    return {
      initialValid,
      stillValid,
      nowInvalid,
    };
  });

  test("5_validation_with_autoFix", () => {
    clearSignalRegistry();
    let autoFixCalled = false;

    const sig = stateSignal("option1", {
      id: "autofix",
      oneOf: ["option1", "option2", "option3"],
      autoFix: () => {
        autoFixCalled = true;
        return "option1";
      },
    });

    sig.value = "invalid";
    const value = sig.value;
    const validityAfterInvalid = sig.validity.valid;

    return {
      autoFixCalled,
      value,
      validityAfterInvalid,
    };
  });
});
