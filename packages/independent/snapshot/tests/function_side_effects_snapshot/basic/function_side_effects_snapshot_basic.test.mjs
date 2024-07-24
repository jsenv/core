import {
  snapshotFunctionSideEffects,
  takeDirectorySnapshot,
} from "@jsenv/snapshot";
import {
  existsSync,
  mkdir,
  mkdirSync,
  readFileSync,
  writeFile,
  writeFileSync,
} from "node:fs";

const startTesting = async (fn) => {
  const testMap = new Map();
  const test = async (scenario, fn, options) => {
    testMap.set(scenario, async () => {
      await snapshotFunctionSideEffects(
        fn,
        import.meta.url,
        `./output/${scenario}/`,
        options,
      );
    });
  };
  fn({ test });
  const outputDirectorySnapshot = takeDirectorySnapshot(
    new URL("./output/", import.meta.url),
  );
  for (const [, runIt] of testMap) {
    await runIt();
  }
  outputDirectorySnapshot.compare();
};

await startTesting(({ test }) => {
  test("0_no_op", () => {});
  test("1_return_undefined", () => undefined);
  test("2_return_null", () => null);
  test("3_return_hello_world", () => "hello world");
  test("4_log_and_return_42", () => {
    console.log("Hello");
    return 42;
  });
  test("5_multiple_console_calls", () => {
    console.log("log_0");
    console.info("info_0");
    console.warn("warn_0");
    console.error("error_0");
    console.log("log_1");
    console.info("info_1");
    console.warn("warn_1");
    console.error("error_1");
  });
  test("6_throw_error", () => {
    throw new Error("here");
  });
  test("7_async_resolving_to_42", async () => {
    const value = await Promise.resolve(42);
    return value;
  });
  test("8_async_rejecting", async () => {
    await Promise.resolve();
    throw new Error("here");
  });
  test("9_async_complex", async () => {
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
  });
  test("10_fs_write_file_sync", () => {
    writeFileSync(new URL("./toto.txt", import.meta.url), "writeFileSync");
  });
  test("11_fs_write_file", async () => {
    await new Promise((resolve, reject) => {
      writeFile(
        new URL("./toto.txt", import.meta.url),
        "writeFile",
        (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        },
      );
    });
  });
  test("12_write_then_read", () => {
    writeFileSync(new URL("./toto.txt", import.meta.url), "a");
    const value = String(readFileSync(new URL("./toto.txt", import.meta.url)));
    return value;
  });
  test("13_mkdir_sync", () => {
    mkdirSync(new URL("./dir/", import.meta.url));
    return existsSync(new URL("./dir/", import.meta.url));
  });
  test("14_mkdir_async", async () => {
    await new Promise((resolve, reject) => {
      mkdir(new URL("./dir/", import.meta.url), (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  });
  test(
    "15_fs_write_file_sync_and_directory",
    () => {
      writeFileSync(
        new URL("./toto.txt", import.meta.url),
        "write_sync_in_dedicated_directory",
      );
    },
    {
      filesystemEffects: {
        outDirectory: "./fs/",
      },
    },
  );
  // TODO: ability to ignore some files
  // (will be used for jsenv build to ignore .jsenv files)
});
