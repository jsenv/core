import {
  readFile,
  readFileSync,
  writeDirectory,
  writeDirectorySync,
  writeFile,
  writeFileSync,
} from "@jsenv/filesystem";
import { snapshotSideEffects, takeDirectorySnapshot } from "@jsenv/snapshot";
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
    await snapshotSideEffects(
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
    test("1_write_then_read_sync", () => {
      writeFileSync(
        new URL("./toto.txt", import.meta.url),
        "1_write_then_read_sync",
      );
      return String(readFileSync(new URL("./toto.txt", import.meta.url)));
    });
    test("2_write_sync_deep", () => {
      writeFileSync(
        new URL("./toto/toto.txt", import.meta.url),
        "2_write_sync_deep",
      );
    });
    test("3_write_async", async () => {
      await writeFile(new URL("./toto.txt", import.meta.url), "3_write_async");
    });
    test(
      "4_write_inside_base",
      () => {
        writeFileSync(
          new URL("./toto.txt", import.meta.url),
          "4_write_inside_base",
        );
      },
      {
        filesystemEffects: {
          baseDirectory: new URL("./", import.meta.url),
        },
      },
    );
    test(
      "5_write_inside_base_and_textual_out",
      () => {
        writeFileSync(
          new URL("./toto.txt", import.meta.url),
          "5_write_inside_base_and_textual_out",
        );
      },
      {
        filesystemEffects: {
          baseDirectory: new URL("./", import.meta.url),
          textualFilesIntoDirectory: true,
        },
      },
    );
    test(
      "6_write_above_base",
      () => {
        writeFileSync(
          new URL("../toto.txt", import.meta.url),
          "6_write_above_base",
        );
      },
      {
        filesystemEffects: {
          baseDirectory: new URL("./", import.meta.url),
        },
      },
    );
    test(
      "7_write_above_base_and_textual_out",
      () => {
        writeFileSync(
          new URL("../toto.txt", import.meta.url),
          "7_write_above_base_and_out",
        );
      },
      {
        filesystemEffects: {
          baseDirectory: new URL("./", import.meta.url),
          textualFilesIntoDirectory: true,
        },
      },
    );
  }
  read_file: {
    // read file twice
    // there was a bug about this in a previous implementation
    // where second read file would never resolve
    test("8_read_file_first", async () => {
      await readFile(import.meta.url, { as: "string" });
    });
    test("9_read_file_second", async () => {
      await readFile(import.meta.url, { as: "string" });
    });
  }
  write_directory: {
    test("10_write_directory_sync", () => {
      writeDirectorySync(new URL("./dir_sync/", import.meta.url));
      return existsSync(new URL("./dir_sync/", import.meta.url));
    });
    test("11_write_directory_async", async () => {
      await writeDirectory(new URL("./dir_async/", import.meta.url));
      return existsSync(new URL("./dir_async/", import.meta.url));
    });
  }
  group_write_by_directory: {
    test(
      "12_write_in_one_dir",
      () => {
        writeFileSync(new URL("./shared/a/a_1.txt", import.meta.url));
        writeFileSync(new URL("./shared/a/a_2.txt", import.meta.url));
        writeFileSync(new URL("./shared/b/b_1.txt", import.meta.url));
        writeFileSync(new URL("./shared/b/b_2.txt", import.meta.url));
        writeFileSync(new URL("./shared/b/b_3.txt", import.meta.url));
      },
      {
        filesystemEffects: {
          baseDirectory: new URL("./", import.meta.url),
          textualFilesIntoDirectory: true,
        },
      },
    );
    test(
      "13_write_in_2_dir",
      () => {
        writeFileSync(new URL("./a/a_1.txt", import.meta.url));
        writeFileSync(new URL("./a/a_2.txt", import.meta.url));
        writeFileSync(new URL("./b/b_1.txt", import.meta.url));
        writeFileSync(new URL("./b/b_2.txt", import.meta.url));
        writeFileSync(new URL("./b/b_3.txt", import.meta.url));
      },
      {
        filesystemEffects: {
          baseDirectory: new URL("./", import.meta.url),
          textualFilesIntoDirectory: true,
        },
      },
    );
    test(
      "14_write_no_out",
      () => {
        writeFileSync(
          new URL("./dist/a_1.txt", import.meta.url),
          "a_1_content",
        );
        writeFileSync(
          new URL("./dist/a_2.txt", import.meta.url),
          "a_2_content",
        );
      },
      {
        filesystemEffects: {
          baseDirectory: new URL("./", import.meta.url),
        },
      },
    );
  }
});
