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

  test("6_dynamic_default_with_static_fallback", () => {
    clearSignalRegistry();
    const dynamicDefault = signal(undefined);
    const sig = stateSignal(dynamicDefault, { default: "fallback_value" });

    // Should use fallback when dynamic is undefined
    const valueAtStart = sig.value;

    // Dynamic default gets a value - should switch to dynamic
    dynamicDefault.value = "dynamic_value";
    const valueAfterDynamicSet = sig.value;

    // Dynamic goes back to undefined - should use fallback again
    dynamicDefault.value = undefined;
    const valueAfterDynamicUndefined = sig.value;

    return {
      valueAtStart,
      valueAfterDynamicSet,
      valueAfterDynamicUndefined,
    };
  });

  test("7_static_fallback_with_user_override", () => {
    clearSignalRegistry();
    const dynamicDefault = signal(undefined);
    const sig = stateSignal(dynamicDefault, { default: "fallback_value" });

    // Initially using fallback
    const initialValue = sig.value;

    // User sets explicit value
    sig.value = "user_value";
    const valueAfterUserSet = sig.value;

    // Dynamic default becomes available - should NOT override user value
    dynamicDefault.value = "dynamic_value";
    const valueAfterDynamicAvailable = sig.value;

    // User resets to undefined - should follow dynamic default
    sig.value = undefined;
    const valueAfterUserReset = sig.value;

    return {
      initialValue,
      valueAfterUserSet,
      valueAfterDynamicAvailable,
      valueAfterUserReset,
    };
  });

  test("8_static_fallback_dynamic_changes", () => {
    clearSignalRegistry();
    const dynamicDefault = signal("initial_dynamic");
    const sig = stateSignal(dynamicDefault, { default: "fallback_value" });

    // Initially uses dynamic (not fallback since dynamic is defined)
    const initialValue = sig.value;

    // Dynamic becomes undefined - should use fallback
    dynamicDefault.value = undefined;
    const valueAfterDynamicUndefined = sig.value;

    // Dynamic gets new value - should follow dynamic again
    dynamicDefault.value = "new_dynamic";
    const valueAfterNewDynamic = sig.value;

    // User sets custom value
    sig.value = "custom";
    const valueAfterCustom = sig.value;

    // Dynamic changes while custom - should keep custom
    dynamicDefault.value = "another_dynamic";
    const valueAfterDynamicChangeWithCustom = sig.value;

    // Dynamic becomes undefined while custom - should keep custom
    dynamicDefault.value = undefined;
    const valueAfterDynamicUndefinedWithCustom = sig.value;

    return {
      initialValue,
      valueAfterDynamicUndefined,
      valueAfterNewDynamic,
      valueAfterCustom,
      valueAfterDynamicChangeWithCustom,
      valueAfterDynamicUndefinedWithCustom,
    };
  });

  test("9_static_fallback_without_dynamic", () => {
    clearSignalRegistry();
    // Test that static fallback option is ignored when not using dynamic default
    const sig = stateSignal("static_default", { default: "ignored_fallback" });

    const value = sig.value;

    return {
      value, // Should be "static_default", not "ignored_fallback"
    };
  });

  test("10_static_fallback_with_persistence", () => {
    clearSignalRegistry();
    const dynamicDefault = signal(undefined);
    const sig = stateSignal(dynamicDefault, {
      default: "fallback_value",
      id: "persist_test",
      persists: false, // Disable for test consistency
    });

    // Initially using fallback
    const initialValue = sig.value;

    // User sets value - should be treated as custom
    sig.value = "user_value";
    const customValue = sig.value;

    // Check isCustomValue function
    const registryEntry = globalSignalRegistry.get("persist_test");
    const isInitialCustom = registryEntry.options.isCustomValue(initialValue);
    const isUserValueCustom = registryEntry.options.isCustomValue(customValue);
    const isFallbackCustom =
      registryEntry.options.isCustomValue("fallback_value");

    return {
      initialValue,
      customValue,
      isInitialCustom, // Should be false (fallback is not custom)
      isUserValueCustom, // Should be true (user value is custom)
      isFallbackCustom, // Should be false when dynamic is undefined
    };
  });
});
