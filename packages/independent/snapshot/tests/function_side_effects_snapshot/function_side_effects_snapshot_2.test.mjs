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
    "./output_2/0_warn_a/",
  );
  assert({ actual: console.warn, expect: warn });
  await snapshotFunctionSideEffects(
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.warn("here");
    },
    import.meta.url,
    "./output_2/1_warn_b/",
  );
  assert({ actual: console.warn, expect: warn });
}

// logs works when b_ends_before_a
{
  const aPromise = snapshotFunctionSideEffects(
    async () => {
      console.log("a_before_timeout_200");
      await new Promise((resolve) => {
        setTimeout(resolve, 200);
      });
      console.log("a_after_timeout_200");
    },
    import.meta.url,
    "./output_2/2_a_when_b_ends_before/",
  );
  const bPromise = snapshotFunctionSideEffects(
    async () => {
      console.log("b_before_timeout_50");
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });
      console.log("b_after_timeout_50");
    },
    import.meta.url,
    "./output_2/3_b_when_b_ends_before/",
  );
  await aPromise;
  await bPromise;
}

// TODO: a ends before b
