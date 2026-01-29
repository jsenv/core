import { snapshotTests } from "@jsenv/snapshot";
import { signal } from "@preact/signals";
import { globalSignalRegistry, stateSignal } from "./state_signal.js";

// Mock localStorage for Node.js testing environment
const createMockLocalStorage = () => {
  const storage = new Map();
  return {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
    get length() {
      return storage.size;
    },
    key: (index) => Array.from(storage.keys())[index] ?? null,
  };
};

// Setup mock window and localStorage
const mockLocalStorage = createMockLocalStorage();
global.window = {
  localStorage: mockLocalStorage,
};

// Clear signals registry and localStorage before each test
const clearAll = () => {
  globalSignalRegistry.clear();
  mockLocalStorage.clear();
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_basic_persistence", () => {
    clearAll();
    const results = [];

    // Create persisting signal with default
    const sig = stateSignal("default", {
      id: "persist_basic",
      persists: true,
    });

    results.push({
      step: "initial value",
      value: sig.value,
      storageSize: mockLocalStorage.length,
    });

    // Set explicit value - should persist
    sig.value = "stored";
    results.push({
      step: "after setting explicit value",
      value: sig.value,
      storageSize: mockLocalStorage.length,
      storageValue: mockLocalStorage.getItem("persist_basic"),
    });

    // Reset to default - should clear from storage
    sig.value = undefined;
    results.push({
      step: "after reset to default",
      value: sig.value,
      storageSize: mockLocalStorage.length,
      storageValue: mockLocalStorage.getItem("persist_basic"),
    });

    return { results };
  });

  test("1_persistence_with_existing_storage", () => {
    clearAll();

    // Pre-populate storage
    mockLocalStorage.setItem("existing", "pre_existing_value");

    // Create signal - should use stored value
    const sig = stateSignal("default", {
      id: "existing",
      persists: true,
    });

    const valueFromStorage = sig.value;
    const defaultWouldBe = "default";

    return {
      valueFromStorage,
      defaultWouldBe,
    };
  });

  test("2_persistence_different_types", () => {
    clearAll();
    const results = [];

    // String signal
    const strSig = stateSignal("default", {
      id: "str_persist",
      persists: true,
      type: "string",
    });

    // Number signal
    const numSig = stateSignal(42, {
      id: "num_persist",
      persists: true,
      type: "number",
    });

    // Boolean signal
    const boolSig = stateSignal(true, {
      id: "bool_persist",
      persists: true,
      type: "boolean",
    });

    // Object signal
    const objSig = stateSignal(
      { count: 0 },
      {
        id: "obj_persist",
        persists: true,
        type: "object",
      },
    );

    // Set values
    strSig.value = "stored_string";
    numSig.value = 123;
    boolSig.value = false;
    objSig.value = { count: 5, name: "test" };

    results.push({
      step: "values after setting",
      strValue: strSig.value,
      numValue: numSig.value,
      boolValue: boolSig.value,
      objValue: objSig.value,
      strStorage: mockLocalStorage.getItem("str_persist"),
      numStorage: mockLocalStorage.getItem("num_persist"),
      boolStorage: mockLocalStorage.getItem("bool_persist"),
      objStorage: mockLocalStorage.getItem("obj_persist"),
    });

    return { results };
  });

  test("3_persistence_with_validation", () => {
    clearAll();
    const results = [];

    const sig = stateSignal("option1", {
      id: "validated_persist",
      persists: true,
      oneOf: ["option1", "option2", "option3"],
    });

    // Set valid value
    sig.value = "option2";
    results.push({
      step: "valid value set",
      value: sig.value,
      valid: sig.validity.valid,
      storage: mockLocalStorage.getItem("validated_persist"),
    });

    // Set invalid value - should still persist but be marked invalid
    sig.value = "invalid";
    results.push({
      step: "invalid value set",
      value: sig.value,
      valid: sig.validity.valid,
      storage: mockLocalStorage.getItem("validated_persist"),
    });

    return { results };
  });

  test("4_persistence_with_dynamic_defaults", () => {
    clearAll();
    const results = [];

    const dynamicDefault = signal("dynamic_initial");
    const sig = stateSignal(dynamicDefault, {
      id: "dynamic_persist",
      persists: true,
    });

    results.push({
      step: "initial with dynamic default",
      value: sig.value,
      dynamicValue: dynamicDefault.value,
      storage: mockLocalStorage.getItem("dynamic_persist"),
    });

    // Change dynamic default - should follow and not persist
    dynamicDefault.value = "dynamic_changed";
    results.push({
      step: "dynamic default changed",
      value: sig.value,
      dynamicValue: dynamicDefault.value,
      storage: mockLocalStorage.getItem("dynamic_persist"),
    });

    // Set explicit value - should persist
    sig.value = "explicit";
    results.push({
      step: "explicit value set",
      value: sig.value,
      storage: mockLocalStorage.getItem("dynamic_persist"),
    });

    // Change dynamic default - should be ignored
    dynamicDefault.value = "ignored";
    results.push({
      step: "dynamic default changed while explicit",
      value: sig.value,
      dynamicValue: dynamicDefault.value,
      storage: mockLocalStorage.getItem("dynamic_persist"),
    });

    // Reset - should clear storage and follow dynamic
    sig.value = undefined;
    results.push({
      step: "reset to follow dynamic",
      value: sig.value,
      dynamicValue: dynamicDefault.value,
      storage: mockLocalStorage.getItem("dynamic_persist"),
    });

    return { results };
  });

  test("5_persistence_storage_cleanup", () => {
    clearAll();
    const storageStates = [];

    const captureStorage = (label) => {
      const keys = [];
      for (let i = 0; i < mockLocalStorage.length; i++) {
        keys.push(mockLocalStorage.key(i));
      }
      storageStates.push({ label, keys, size: mockLocalStorage.length });
    };

    captureStorage("initial empty");

    // Create multiple persisting signals
    const sig1 = stateSignal("default1", { id: "cleanup1", persists: true });
    const sig2 = stateSignal("default2", { id: "cleanup2", persists: true });
    captureStorage("after creation");

    // Set explicit values
    sig1.value = "stored1";
    sig2.value = "stored2";
    captureStorage("after setting values");

    // Reset one signal
    sig1.value = undefined;
    captureStorage("after resetting sig1");

    // Reset second signal
    sig2.value = undefined;
    captureStorage("after resetting sig2");

    return { storageStates };
  });

  test("6_persistence_reactive_storage_updates", () => {
    clearAll();
    const storageUpdates = [];

    // Track storage changes
    const originalSetItem = mockLocalStorage.setItem;
    const originalRemoveItem = mockLocalStorage.removeItem;

    mockLocalStorage.setItem = (key, value) => {
      storageUpdates.push({ action: "set", key, value });
      originalSetItem.call(mockLocalStorage, key, value);
    };

    mockLocalStorage.removeItem = (key) => {
      storageUpdates.push({ action: "remove", key });
      originalRemoveItem.call(mockLocalStorage, key);
    };

    const sig = stateSignal("default", {
      id: "reactive_persist",
      persists: true,
    });

    // Various operations
    sig.value = "first";
    sig.value = "second";
    sig.value = undefined;
    sig.value = "third";
    sig.reset();

    // Restore original methods
    mockLocalStorage.setItem = originalSetItem;
    mockLocalStorage.removeItem = originalRemoveItem;

    return { storageUpdates };
  });

  test("7_persistence_with_autofix", () => {
    clearAll();

    let autoFixCalls = [];
    const sig = stateSignal("option1", {
      id: "autofix_persist",
      persists: true,
      oneOf: ["option1", "option2", "option3"],
      autoFix: (value) => {
        autoFixCalls.push(value);
        return "option1";
      },
    });

    // Set invalid value - should persist but trigger autofix
    sig.value = "invalid";

    const results = {
      value: sig.value,
      valid: sig.validity.valid,
      storage: mockLocalStorage.getItem("autofix_persist"),
      autoFixCalls,
    };

    return { results };
  });
});
