import { assert } from "@jsenv/assert";
import { readFile, writeFile } from "@jsenv/filesystem";
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
    "./output/0_warn_a/",
  );
  assert({ actual: console.warn, expect: warn });
  await snapshotFunctionSideEffects(
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.warn("here");
    },
    import.meta.url,
    "./output/1_warn_b/",
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
    "./output/2_a_when_b_ends_before/",
    {
      filesystemEffects: {
        preserve: true,
      },
    },
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
    "./output/3_b_when_b_ends_before/",
    {
      filesystemEffects: {
        preserve: true,
      },
    },
  );
  await aPromise;
  await bPromise;
}

// write several files
{
  await snapshotFunctionSideEffects(
    async () => {
      await writeFile(new URL("./a.txt", import.meta.url), "a_1");
      await writeFile(new URL("./b.txt", import.meta.url), "b_1");
      await writeFile(new URL("./c.txt", import.meta.url), "c_1");
    },
    import.meta.url,
    "./output/4_write_first/",
  );
  await snapshotFunctionSideEffects(
    async () => {
      await writeFile(new URL("./a.txt", import.meta.url), "a_2");
      await writeFile(new URL("./b.txt", import.meta.url), "b_2");
      await writeFile(new URL("./c.txt", import.meta.url), "c_2");
    },
    import.meta.url,
    "./output/5_write_second/",
  );
}

// do read file twice
{
  await snapshotFunctionSideEffects(
    async () => {
      await readFile(import.meta.url, { as: "string" });
    },
    import.meta.url,
    "./output/6_read_file_first/",
  );
  setTimeout(() => {}, 1_000);

  await snapshotFunctionSideEffects(
    async () => {
      await readFile(import.meta.url, { as: "string" });
    },
    import.meta.url,
    "./output/7_read_file_second/",
  );
}
