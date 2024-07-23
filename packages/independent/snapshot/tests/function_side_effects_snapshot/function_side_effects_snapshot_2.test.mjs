import { assert } from "@jsenv/assert";
import { snapshotFunctionSideEffects } from "@jsenv/snapshot";

// warn property restored
{
  const warn = console.warn;
  await snapshotFunctionSideEffects(
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.warn("here");
    },
    import.meta.url,
    "./output_2/",
  );
  assert({ actual: console.warn, expect: warn });
  await snapshotFunctionSideEffects(
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.warn("here");
    },
    import.meta.url,
    "./output_2/",
  );
  assert({ actual: console.warn, expect: warn });
}

// throw if called twice
{
  snapshotFunctionSideEffects(async () => {}, import.meta.url, "./output_2/");
  try {
    snapshotFunctionSideEffects(() => {}, import.meta.url, "./output_2/");
    throw new Error("should throw");
  } catch (e) {
    const actual = e;
    const expect = new Error("snapshotFunctionSideEffects already running");
    assert({ actual, expect });
  }
}
