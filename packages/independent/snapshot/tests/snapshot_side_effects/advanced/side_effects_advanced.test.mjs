import { assert } from "@jsenv/assert";
import { writeFile, writeFileSync } from "@jsenv/filesystem";
import { snapshotSideEffects } from "@jsenv/snapshot";

// warn property restored
{
  const warn = console.warn;
  await snapshotSideEffects(
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.warn("here");
    },
    new URL("./output/0_warn_a.md", import.meta.url),
  );
  assert({ actual: console.warn, expect: warn });
  await snapshotSideEffects(
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.warn("here");
    },
    new URL("./output/1_warn_b.md", import.meta.url),
  );
  assert({ actual: console.warn, expect: warn });
}

// logs works when b_ends_before_a
{
  const aPromise = snapshotSideEffects(
    async () => {
      console.log("a_before_timeout_200");
      await new Promise((resolve) => {
        setTimeout(resolve, 200);
      });
      console.log("a_after_timeout_200");
    },
    new URL("./output/2_a_when_b_ends_before.md", import.meta.url),
    {
      filesystemEffects: {
        preserve: true,
      },
    },
  );
  const bPromise = snapshotSideEffects(
    async () => {
      console.log("b_before_timeout_50");
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });
      console.log("b_after_timeout_50");
    },
    new URL("./output/3_b_when_b_ends_before.md", import.meta.url),
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
  await snapshotSideEffects(
    async () => {
      await writeFile(new URL("./a.txt", import.meta.url), "a_1");
      await writeFile(new URL("./b.txt", import.meta.url), "b_1");
      await writeFile(new URL("./c.txt", import.meta.url), "c_1");
    },
    new URL("./output/4_write_first.md", import.meta.url),
  );
  await snapshotSideEffects(
    async () => {
      await writeFile(new URL("./a.txt", import.meta.url), "a_2");
      await writeFile(new URL("./b.txt", import.meta.url), "b_2");
      await writeFile(new URL("./c.txt", import.meta.url), "c_2");
    },
    new URL("./output/5_write_second.md", import.meta.url),
  );
}

// console and filesystem
{
  await snapshotSideEffects(
    async () => {
      console.log("start");
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });
      console.info("timeout done");
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });
      console.warn("a warning after 2nd timeout");
      console.warn("and an other warning");
      writeFileSync(new URL("./toto.txt", import.meta.url), "toto");
      throw new Error("in the end we throw");
    },
    new URL("./output/6_console_and_file.md", import.meta.url),
  );
}

// console grouped and fs
snapshotSideEffects(
  async () => {
    console.info(`build "./main.html"`);
    process.stdout.write("⠋ generate source graph\n");
    process.stdout.write("✔ generate source graph (done in 0.02 second)\n");
    process.stdout.write("⠋ generate build graph\n");
    process.stdout.write("✔ generate build graph (done in 0.005 second)\n");
    process.stdout.write("⠋ write files in build directory\n");
    writeFileSync(new URL("./dist/toto.txt", import.meta.url), "toto");
    writeFileSync(new URL("./dist/tata.txt", import.meta.url), "tata");
    process.stdout.write(
      "✔ write files in build directory (done in 0.002 second)\n",
    );
    console.info(`--- build files ---  
- [90mhtml :[0m 1 (175 B / 91 %)
- [90mjs   :[0m 1 (17 B / 9 %)
- [90mtotal:[0m 2 (192 B / 100 %)
--------------------`);
  },
  new URL("./output/7_console_group_and_fs_group.md", import.meta.url),
  {
    filesystemEffects: {
      baseDirectory: new URL("./", import.meta.url),
    },
    logEffects: {
      group: true,
    },
  },
);
