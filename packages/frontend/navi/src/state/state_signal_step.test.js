import { snapshotTests } from "@jsenv/snapshot";

import { globalSignalRegistry, stateSignal } from "./state_signal.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("step rounding basic behavior", () => {
    try {
      const signal = stateSignal(1.0, { type: "number", step: 0.1 });

      const results = [];
      results.push({ description: "initial value", value: signal.value });

      // Test various values that should round to different steps
      signal.value = 1.234567;
      results.push({ description: "after 1.234567", value: signal.value });

      signal.value = 1.05; // Should round to 1.1
      results.push({ description: "after 1.05", value: signal.value });

      signal.value = 1.04; // Should round to 1.0
      results.push({ description: "after 1.04", value: signal.value });

      signal.value = 1.777; // Should round to 1.8
      results.push({ description: "after 1.777", value: signal.value });

      return { results };
    } finally {
      globalSignalRegistry.clear();
    }
  });

  test("step with different increments", () => {
    try {
      // Test step 0.01 (cents)
      const centSignal = stateSignal(19.99, { type: "number", step: 0.01 });
      
      // Test step 1 (whole numbers)
      const wholeSignal = stateSignal(5, { type: "number", step: 1 });
      
      // Test step 0.5 (half units)
      const halfSignal = stateSignal(2.5, { type: "number", step: 0.5 });

      const results = [];
      
      // Cent precision
      centSignal.value = 19.999999;
      results.push({ description: "cent step 19.999999", value: centSignal.value });
      
      centSignal.value = 20.004;
      results.push({ description: "cent step 20.004", value: centSignal.value });
      
      // Whole number precision
      wholeSignal.value = 5.7;
      results.push({ description: "whole step 5.7", value: wholeSignal.value });
      
      wholeSignal.value = 5.3;
      results.push({ description: "whole step 5.3", value: wholeSignal.value });
      
      // Half unit precision
      halfSignal.value = 2.3;
      results.push({ description: "half step 2.3", value: halfSignal.value });
      
      halfSignal.value = 2.8;
      results.push({ description: "half step 2.8", value: halfSignal.value });

      return { results };
    } finally {
      globalSignalRegistry.clear();
    }
  });

  test("effects should not trigger for redundant step values", () => {
    try {
      const signal = stateSignal(1.0, { type: "number", step: 0.1 });
      
      const effectCalls = [];
      let effectRunCount = 0;
      
      // Subscribe to signal changes
      signal.subscribe(() => {
        effectRunCount++;
        effectCalls.push({
          run: effectRunCount,
          value: signal.value,
          timestamp: Date.now()
        });
      });

      // Initial subscription call
      const initialEffectCount = effectRunCount;

      // Set values that should round to the same result
      signal.value = 1.04; // Rounds to 1.0 (same as current)
      const afterSameValueCount = effectRunCount;

      signal.value = 1.02; // Rounds to 1.0 (same as current)
      const afterAnotherSameValueCount = effectRunCount;

      // Set a value that should actually change the result
      signal.value = 1.15; // Rounds to 1.1 (different)
      const afterDifferentValueCount = effectRunCount;

      // Set another value that rounds to the same new value
      signal.value = 1.13; // Rounds to 1.1 (same as current 1.1)
      const afterSameFinalValueCount = effectRunCount;

      return {
        initial_effect_count: initialEffectCount,
        after_same_value_count: afterSameValueCount,
        after_another_same_value_count: afterAnotherSameValueCount,
        after_different_value_count: afterDifferentValueCount,
        after_same_final_value_count: afterSameFinalValueCount,
        total_effect_calls: effectCalls.length,
        effect_calls: effectCalls.map(call => ({ run: call.run, value: call.value }))
      };
    } finally {
      globalSignalRegistry.clear();
    }
  });

  test("step behavior with non-number types", () => {
    try {
      // String signal with step should be ignored
      const stringSignal = stateSignal("hello", { type: "string", step: 0.1 });
      
      // Number signal without step should pass through
      const plainNumberSignal = stateSignal(3.14159, { type: "number" });
      
      // Boolean signal with step should be ignored
      const boolSignal = stateSignal(true, { type: "boolean", step: 1 });

      const results = [];

      stringSignal.value = "world";
      results.push({ description: "string with step", value: stringSignal.value });

      plainNumberSignal.value = 2.71828;
      results.push({ description: "number without step", value: plainNumberSignal.value });

      boolSignal.value = false;
      results.push({ description: "boolean with step", value: boolSignal.value });

      // Test setting number values on string signal (should pass through)
      stringSignal.value = 1.234;
      results.push({ description: "string signal with number", value: stringSignal.value });

      return { results };
    } finally {
      globalSignalRegistry.clear();
    }
  });

  test("step with undefined and null values", () => {
    try {
      const signal = stateSignal(1.0, { type: "number", step: 0.1 });
      
      const results = [];
      results.push({ description: "initial", value: signal.value });

      // Setting undefined should pass through (not processed)
      signal.value = undefined;
      results.push({ description: "after undefined", value: signal.value });

      // Setting null should pass through (not processed)
      signal.value = null;
      results.push({ description: "after null", value: signal.value });

      // Setting back to a number should process with step
      signal.value = 2.34;
      results.push({ description: "back to number 2.34", value: signal.value });

      return { results };
    } finally {
      globalSignalRegistry.clear();
    }
  });

  test("step precision edge cases", () => {
    try {
      const signal = stateSignal(0, { type: "number", step: 0.1 });
      
      const results = [];

      // Test values near zero
      signal.value = 0.05; // Should round to 0.1
      results.push({ description: "0.05 -> 0.1", value: signal.value });

      signal.value = 0.04; // Should round to 0.0
      results.push({ description: "0.04 -> 0.0", value: signal.value });

      signal.value = -0.05; // Should round to -0.1
      results.push({ description: "-0.05 -> -0.1", value: signal.value });

      signal.value = -0.04; // Should round to 0.0
      results.push({ description: "-0.04 -> 0.0", value: signal.value });

      // Test larger values
      signal.value = 99.97; // Should round to 100.0
      results.push({ description: "99.97 -> 100.0", value: signal.value });

      signal.value = 99.93; // Should round to 99.9
      results.push({ description: "99.93 -> 99.9", value: signal.value });

      return { results };
    } finally {
      globalSignalRegistry.clear();
    }
  });

  test("step with connection isDefaultValue integration", () => {
    try {
      // Test that isDefaultValue works correctly with step rounding
      const signal = stateSignal(1.0, { type: "number", step: 0.1, id: "stepDefault" });
      
      // Get the registry entry to test isDefaultValue
      const registryEntry = globalSignalRegistry.get("stepDefault");
      const { isDefaultValue } = registryEntry.options;

      const results = [];

      // Test default value detection with step
      results.push({ 
        description: "isDefaultValue(1.0)", 
        result: isDefaultValue(1.0) 
      });

      // Values that round to the default should be considered default
      results.push({ 
        description: "isDefaultValue(1.04) - rounds to 1.0", 
        result: isDefaultValue(1.04) 
      });

      // Values that round to something else should not be default
      results.push({ 
        description: "isDefaultValue(1.15) - rounds to 1.1", 
        result: isDefaultValue(1.15) 
      });

      // Change signal value and test again
      signal.value = 2.0;
      results.push({ 
        description: "after changing signal to 2.0", 
        signal_value: signal.value,
        isDefaultValue_1_0: isDefaultValue(1.0),
        isDefaultValue_2_0: isDefaultValue(2.0)
      });

      return { results };
    } finally {
      globalSignalRegistry.clear();
    }
  });

  test("step with very small increments", () => {
    try {
      // Test precision with very small steps
      const microSignal = stateSignal(0, { type: "number", step: 0.001 });
      
      const results = [];

      microSignal.value = 0.0015; // Should round to 0.002
      results.push({ description: "0.0015 with step 0.001", value: microSignal.value });

      microSignal.value = 0.0014; // Should round to 0.001
      results.push({ description: "0.0014 with step 0.001", value: microSignal.value });

      microSignal.value = 1.2345678; // Should round to 1.235
      results.push({ description: "1.2345678 with step 0.001", value: microSignal.value });

      return { results };
    } finally {
      globalSignalRegistry.clear();
    }
  });

  test("step behavior in reactive chains", () => {
    try {
      const sourceSignal = stateSignal(1.0, { type: "number", step: 0.1, id: "source" });
      const derivedValues = [];
      let computationCount = 0;

      // Create a derived computation that depends on the stepped signal
      const unsubscribe = sourceSignal.subscribe(() => {
        computationCount++;
        derivedValues.push({
          computation: computationCount,
          source_value: sourceSignal.value,
          doubled: sourceSignal.value * 2
        });
      });

      // Set values that should trigger different numbers of computations
      sourceSignal.value = 1.04; // Should round to 1.0, might not trigger
      sourceSignal.value = 1.02; // Should round to 1.0, might not trigger  
      sourceSignal.value = 1.15; // Should round to 1.1, should trigger
      sourceSignal.value = 1.13; // Should round to 1.1, might not trigger
      sourceSignal.value = 1.25; // Should round to 1.3, should trigger

      unsubscribe();

      return {
        total_computations: computationCount,
        derived_values: derivedValues,
        final_source_value: sourceSignal.value
      };
    } finally {
      globalSignalRegistry.clear();
    }
  });
});