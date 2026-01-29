import { snapshotSideEffects, takeDirectorySnapshot } from "@jsenv/snapshot";

const startTesting = async (fn) => {
  const scenarioMap = new Map();
  const onlyScenarioMap = new Map();
  const test = (scenario, fn, options) => {
    scenarioMap.set(scenario, { fn, options });
  };
  test.ONLY = (scenario, fn, options) => {
    onlyScenarioMap.set(scenario, { fn, options });
  };
  fn({ test });
  const outputDirectorySnapshot = takeDirectorySnapshot(
    new URL("./output/", import.meta.url),
  );
  const activeScenarioMap = onlyScenarioMap.size
    ? onlyScenarioMap
    : scenarioMap;
  for (const [scenario, { fn, options }] of activeScenarioMap) {
    await snapshotSideEffects(import.meta.url, fn, {
      sideEffectMdFileUrl: new URL(`./output/${scenario}.md`, import.meta.url),
      ...options,
    });
  }
  outputDirectorySnapshot.compare();
};

await startTesting(({ test }) => {
  test("0_no_op", () => {});
  test("1_return_undefined", () => undefined);
  test("2_return_null", () => null);
  test("3_return_hello_world", () => "hello world");
  test("4_throw_error", () => {
    throw new Error("here");
  });
  test("5_async_resolving_to_42", async () => {
    const value = await Promise.resolve(42);
    return value;
  });
  test("6_async_rejecting", async () => {
    await Promise.resolve();
    throw new Error("here");
  });
  test("7_object_with_undefined_props", () => {
    return {
      a: undefined,
      b: 42,
      c: null,
      d: "defined",
    };
  });
  test("8_complex_undefined_edge_cases", () => {
    return {
      plainUndefined: undefined,
      stringWithUndefinedText: "This contains __UNDEFINED__ text",
      nestedObject: {
        innerUndefined: undefined,
        innerDefined: "value",
      },
      arrayWithUndefined: [undefined, "defined", null],
      undefinedString: "__UNDEFINED__", // This should not be confused with actual undefined
      mixed: {
        a: undefined,
        b: "__UNDEFINED__",
        c: null,
      },
    };
  });
});
