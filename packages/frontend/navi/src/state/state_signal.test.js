import { snapshotTests } from "@jsenv/snapshot";
import { effect, signal } from "@preact/signals";
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
    let fixedValue = null;

    const sig = stateSignal("option1", {
      id: "autofix",
      oneOf: ["option1", "option2", "option3"],
      autoFix: (invalidValue) => {
        autoFixCalled = true;
        fixedValue = invalidValue;
        return "option1"; // fallback to first option
      },
    });

    sig.value = "invalid";
    const validityAfterInvalid = sig.validity.valid;

    return {
      autoFixCalled,
      fixedValue,
      validityAfterInvalid,
    };
  });

  test("6_signal_id_and_registry", () => {
    clearSignalRegistry();
    const sig1 = stateSignal("value", { id: "custom_id" });
    const sig2 = stateSignal("value"); // auto-generated id

    const customId = sig1.__signalId;
    const autoId = sig2.__signalId;
    const registrySize = globalSignalRegistry.size;

    return {
      customId,
      autoId,
      registrySize,
    };
  });

  test("7_signal_id_conflict", () => {
    clearSignalRegistry();
    stateSignal("first", { id: "duplicate" });

    let errorMessage = null;
    try {
      stateSignal("second", { id: "duplicate" });
    } catch (error) {
      errorMessage = error.message;
    }

    return {
      errorMessage,
    };
  });

  test("8_reactive_effects", () => {
    clearSignalRegistry();
    const results = [];
    const dynamicDefault = signal("initial");
    const sig = stateSignal(dynamicDefault);

    // Track changes via effect
    effect(() => {
      results.push(sig.value);
    });

    // Change dynamic default
    dynamicDefault.value = "changed";

    // Set explicit value
    sig.value = "explicit";

    // Change dynamic default again (should not affect)
    dynamicDefault.value = "ignored";

    // Reset to follow dynamic again
    sig.value = undefined;

    // Change dynamic default once more
    dynamicDefault.value = "followed";

    return {
      results,
    };
  });

  test("9_undefined_dynamic_default", () => {
    clearSignalRegistry();
    const dynamicDefault = signal(undefined);
    const sig = stateSignal(dynamicDefault);

    const valueWithUndefinedDefault = sig.value;

    dynamicDefault.value = "now_defined";
    const valueWithDefinedDefault = sig.value;

    sig.value = "explicit";
    dynamicDefault.value = undefined;
    const valueWithExplicitIgnoringUndefined = sig.value;

    sig.value = undefined;
    const valueBackToUndefinedDefault = sig.value;

    return {
      valueWithUndefinedDefault,
      valueWithDefinedDefault,
      valueWithExplicitIgnoringUndefined,
      valueBackToUndefinedDefault,
    };
  });

  test("10_complex_data_types", () => {
    clearSignalRegistry();
    const objectDefault = { name: "default", count: 0 };
    const arrayDefault = [1, 2, 3];

    const objSig = stateSignal(objectDefault);
    const arrSig = stateSignal(arrayDefault);

    const objInitial = objSig.value;
    const arrInitial = arrSig.value;

    objSig.value = { name: "custom", count: 5 };
    arrSig.value = ["a", "b"];

    const objCustom = objSig.value;
    const arrCustom = arrSig.value;

    objSig.value = undefined;
    arrSig.value = undefined;

    const objReset = objSig.value;
    const arrReset = arrSig.value;

    return {
      objInitial,
      arrInitial,
      objCustom,
      arrCustom,
      objReset,
      arrReset,
    };
  });

  test("11_signal_toString", () => {
    clearSignalRegistry();
    const sig1 = stateSignal("value", { id: "custom_id" });
    const sig2 = stateSignal("value"); // auto-generated id

    const customToString = sig1.toString();
    const autoToString = sig2.toString();

    return {
      customToString,
      autoToString,
    };
  });
});
