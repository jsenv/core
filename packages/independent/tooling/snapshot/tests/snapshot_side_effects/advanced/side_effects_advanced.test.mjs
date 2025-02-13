import { assert } from "@jsenv/assert";
import { writeFile, writeFileSync } from "@jsenv/filesystem";
import { snapshotSideEffects } from "@jsenv/snapshot";

// warn property restored
{
  const warn = console.warn;
  await snapshotSideEffects(
    import.meta.url,
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.warn("here");
    },
    {
      sideEffectMdFileUrl: new URL("./output/0_warn_a.md", import.meta.url),
      outFilePattern: "./output/0_warn_a/[filename]",
    },
  );
  assert({ actual: console.warn, expect: warn });
  await snapshotSideEffects(
    import.meta.url,
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      console.warn("here");
    },
    {
      sideEffectMdFileUrl: new URL("./output/1_warn_b.md", import.meta.url),
      outFilePattern: "./output/1_warn_b/[filename]",
    },
  );
  assert({ actual: console.warn, expect: warn });
}

// logs works when b_ends_before_a
{
  const aPromise = snapshotSideEffects(
    import.meta.url,
    async () => {
      console.log("a_before_timeout_200");
      await new Promise((resolve) => {
        setTimeout(resolve, 200);
      });
      console.log("a_after_timeout_200");
    },
    {
      sideEffectMdFileUrl: new URL(
        "./output/2_a_when_b_ends_before.md",
        import.meta.url,
      ),
      outFilePattern: "./output/2_a_when_b_ends_before/[filename]",
      filesystemEffects: {
        preserve: true,
        textualFilesInline: true,
      },
    },
  );
  const bPromise = snapshotSideEffects(
    import.meta.url,
    async () => {
      console.log("b_before_timeout_50");
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });
      console.log("b_after_timeout_50");
    },
    {
      sideEffectMdFileUrl: new URL(
        "./output/3_b_when_b_ends_before.md",
        import.meta.url,
      ),
      outFilePattern: "./output/3_b_when_b_ends_before/[filename]",
      filesystemEffects: {
        preserve: true,
        textualFilesInline: true,
      },
    },
  );
  await aPromise;
  await bPromise;
}

// write several files
{
  await snapshotSideEffects(
    import.meta.url,
    async () => {
      await writeFile(new URL("./a.txt", import.meta.url), "a_1");
      await writeFile(new URL("./b.txt", import.meta.url), "b_1");
      await writeFile(new URL("./c.txt", import.meta.url), "c_1");
    },
    {
      sideEffectMdFileUrl: new URL(
        "./output/4_write_first.md",
        import.meta.url,
      ),
      outFilePattern: "./output/4_write_first/[filename]",
      filesystemEffects: {
        textualFilesInline: true,
      },
    },
  );
  await snapshotSideEffects(
    import.meta.url,
    async () => {
      await writeFile(new URL("./a.txt", import.meta.url), "a_2");
      await writeFile(new URL("./b.txt", import.meta.url), "b_2");
      await writeFile(new URL("./c.txt", import.meta.url), "c_2");
    },
    {
      sideEffectMdFileUrl: new URL(
        "./output/5_write_second.md",
        import.meta.url,
      ),
      outFilePattern: "./output/5_write_second/[filename]",
      filesystemEffects: {
        textualFilesInline: true,
      },
    },
  );
}

// console and filesystem
{
  await snapshotSideEffects(
    import.meta.url,
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
    {
      executionEffects: { catch: true },
      sideEffectMdFileUrl: new URL(
        "./output/6_console_and_file.md",
        import.meta.url,
      ),
      outFilePattern: "./output/6_console_and_file/[filename]",
      filesystemEffects: {
        textualFilesInline: true,
      },
    },
  );
}

// console grouped and fs
await snapshotSideEffects(
  import.meta.url,
  async () => {
    console.info(`build "./main.html"`);
    process.stdout.write("⠋ generate source graph\n");
    process.stdout.write("✔ generate source graph (done in 0.02 second)\n");
    process.stdout.write("⠋ generate build graph\n");
    process.stdout.write("✔ generate build graph (done in 0.005 second)\n");
    process.stdout.write("⠋ write files in build directory\n");
    writeFileSync(new URL("./build/toto.txt", import.meta.url), "toto");
    writeFileSync(new URL("./build/tata.txt", import.meta.url), "tata");
    process.stdout.write(
      "✔ write files in build directory (done in 0.002 second)\n",
    );
    console.info(`--- build files ---  
- [90mhtml :[0m 1 (175 B / 91 %)
- [90mjs   :[0m 1 (17 B / 9 %)
- [90mtotal:[0m 2 (192 B / 100 %)
--------------------`);
  },
  {
    sideEffectMdFileUrl: new URL(
      "./output/7_console_group_and_fs_group.md",
      import.meta.url,
    ),
    outFilePattern: "./output/7_console_group_and_fs_group/[filename]",
    filesystemEffects: {
      textualFilesInline: true,
    },
  },
);
