import {
  readFile,
  readFileSync,
  writeDirectory,
  writeDirectorySync,
  writeFile,
  writeFileSync,
} from "@jsenv/filesystem";
import {
  snapshotFunctionSideEffects,
  takeDirectorySnapshot,
} from "@jsenv/snapshot";
import { existsSync } from "node:fs";

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
    await snapshotFunctionSideEffects(
      fn,
      new URL(`./output/${scenario}.md`, import.meta.url),
      options,
    );
  }
  outputDirectorySnapshot.compare();
};

await startTesting(({ test }) => {
  write_file: {
    test("0_write_sync", () => {
      writeFileSync(
        new URL("./toto.txt", import.meta.url),
        "0_write_file_sync",
      );
    });
    test(
      "1_write_sync_root_dir",
      () => {
        writeFileSync(
          new URL("./toto.txt", import.meta.url),
          "1_write_sync_root_dir",
        );
      },
      {
        filesystemEffects: {
          rootDirectory: new URL("./", import.meta.url),
        },
      },
    );
    test("1_write_then_read_sync", () => {
      writeFileSync(
        new URL("./toto.txt", import.meta.url),
        "1_write_then_read_sync",
      );
      return String(readFileSync(new URL("./toto.txt", import.meta.url)));
    });
    test(
      "2_write_sync_out_directory",
      () => {
        writeFileSync(
          new URL("./toto.txt", import.meta.url),
          "2_write_sync_out_directory",
        );
      },
      {
        filesystemEffects: {
          rootDirectory: new URL("./", import.meta.url),
          outDirectory: "./2_write_sync_out_directory/",
        },
      },
    );
    test("3_write_sync_deep", () => {
      writeFileSync(
        new URL("./toto/toto.txt", import.meta.url),
        "3_write_sync_deep",
      );
    });
    test("4_write_async", async () => {
      await writeFile(new URL("./toto.txt", import.meta.url), "4_write_async");
    });
  }
  read_file: {
    // read file twice
    // there was a bug about this in a previous implementation
    // where second read file would never resolve
    test("5_read_file_first", async () => {
      await readFile(import.meta.url, { as: "string" });
    });
    test("6_read_file_second", async () => {
      await readFile(import.meta.url, { as: "string" });
    });
  }
  write_directory: {
    test("7_write_directory_sync", () => {
      writeDirectorySync(new URL("./dir_sync/", import.meta.url));
      return existsSync(new URL("./dir_sync/", import.meta.url));
    });
    test("8_write_directory_async", async () => {
      await writeDirectory(new URL("./dir_async/", import.meta.url));
      return existsSync(new URL("./dir_async/", import.meta.url));
    });
  }
});
