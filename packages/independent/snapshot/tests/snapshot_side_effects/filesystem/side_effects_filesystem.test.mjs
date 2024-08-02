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
    await snapshotSideEffects(import.meta.url, fn, {
      sideEffectFileUrl: new URL(`./output/${scenario}.md`, import.meta.url),
      outFilePattern: `./output/${scenario}/[filename]`,
      ...options,
    });
  }
  outputDirectorySnapshot.compare();
};

await startTesting(({ test }) => {
  read_file: {
    // read file twice
    // there was a bug about this in a previous implementation
    // where second read file would never resolve
    test("read_file/0_read_file_first", async () => {
      await readFile(import.meta.url, { as: "string" });
    });
    test("read_file/1_read_file_second", async () => {
      await readFile(import.meta.url, { as: "string" });
    });
  }
  write_directory: {
    test("write_dir/0_write_directory_sync", () => {
      writeDirectorySync(new URL("./dir_sync/", import.meta.url));
      return existsSync(new URL("./dir_sync/", import.meta.url));
    });
    test("write_dir/1_write_directory_async", async () => {
      await writeDirectory(new URL("./dir_async/", import.meta.url));
      return existsSync(new URL("./dir_async/", import.meta.url));
    });
    test(
      "write_dir/2_write_dir_deep",
      () => {
        writeDirectorySync(new URL("./dir/a/b/c", import.meta.url));
      },
      {
        filesystemEffects: {
          baseDirectory: new URL("./", import.meta.url),
        },
      },
    );
  }
  write_file: {
    test(
      "write_file/0_write_sync",
      () => {
        writeFileSync(
          new URL("./toto.txt", import.meta.url),
          "0_write_file_sync",
        );
      },
      {
        filesystemEffects: {
          textualFilesInline: true,
        },
      },
    );
    test(
      "write_file/1_write_then_read_sync",
      () => {
        writeFileSync(
          new URL("./toto.txt", import.meta.url),
          "1_write_then_read_sync",
        );
        return String(readFileSync(new URL("./toto.txt", import.meta.url)));
      },
      {
        filesystemEffects: {
          textualFilesInline: true,
        },
      },
    );
    test(
      "write_file/2_write_sync_deep",
      () => {
        writeFileSync(
          new URL("./toto/toto.txt", import.meta.url),
          "2_write_sync_deep",
        );
      },
      {
        filesystemEffects: {
          textualFilesInline: true,
        },
      },
    );
    test(
      "write_file/3_write_async",
      async () => {
        await writeFile(
          new URL("./toto.txt", import.meta.url),
          "3_write_async",
        );
      },
      {
        filesystemEffects: {
          textualFilesInline: true,
        },
      },
    );
    test(
      "write_file/4_write_inside_base",
      () => {
        writeFileSync(
          new URL("./toto.txt", import.meta.url),
          "4_write_inside_base",
        );
      },
      {
        filesystemEffects: {
          textualFilesInline: true,
          baseDirectory: new URL("./", import.meta.url),
        },
      },
    );
    test(
      "write_file/5_write_inside_base_and_textual_out",
      () => {
        writeFileSync(
          new URL("./toto.txt", import.meta.url),
          "5_write_inside_base_and_textual_out",
        );
      },
      {
        filesystemEffects: {
          baseDirectory: new URL("./", import.meta.url),
        },
      },
    );
    test(
      "write_file/6_write_above_base",
      () => {
        writeFileSync(
          new URL("../toto.txt", import.meta.url),
          "6_write_above_base",
        );
      },
      {
        filesystemEffects: {
          textualFilesInline: true,
          baseDirectory: new URL("./", import.meta.url),
        },
      },
    );
    test(
      "write_file/7_write_above_base_and_textual_out",
      () => {
        writeFileSync(
          new URL("../toto.txt", import.meta.url),
          "7_write_above_base_and_out",
        );
      },
      {
        filesystemEffects: {
          baseDirectory: new URL("./", import.meta.url),
        },
      },
    );
    test(
      "write_file/8_write_same_file",
      () => {
        writeFileSync(new URL("./toto.txt", import.meta.url), "a");
        writeFileSync(new URL("./toto.txt", import.meta.url), "b");
      },
      {
        filesystemEffects: {
          textualFilesInline: true,
          baseDirectory: new URL("./", import.meta.url),
        },
      },
    );
    test(
      "write_file/9_write_same_file_again",
      () => {
        writeFileSync(new URL("./dist/a.txt", import.meta.url), "a");
        writeFileSync(new URL("./dist/b.txt", import.meta.url), "b");
        writeFileSync(new URL("./dist/b.txt", import.meta.url), "b");
        writeFileSync(new URL("./dist/c.txt", import.meta.url), "c");
      },
      {
        filesystemEffects: {
          textualFilesInline: true,
          baseDirectory: new URL("./", import.meta.url),
        },
      },
    );

    test(
      "write_file/10_write_same_file_not_grouped",
      () => {
        writeFileSync(new URL("./toto.txt", import.meta.url), "first");
        console.log("hey");
        writeFileSync(new URL("./toto.txt", import.meta.url), "second");
      },
      {
        filesystemEffects: {
          textualFilesInline: true,
          baseDirectory: new URL("./", import.meta.url),
        },
      },
    );
    test(
      "write_file/11_write_same_file_not_grouped_and_out",
      () => {
        writeFileSync(new URL("./toto.txt", import.meta.url), "first");
        console.log("hey");
        writeFileSync(new URL("./toto.txt", import.meta.url), "second");
      },
      {
        filesystemEffects: {
          baseDirectory: new URL("./", import.meta.url),
        },
      },
    );
    test(
      "write_file/12_write_png",
      () => {
        writeFileSync(
          new URL("./jsenv.png", import.meta.url),
          readFileSync(new URL("./input/jsenv.png", import.meta.url)),
        );
      },
      {
        filesystemEffects: {
          baseDirectory: new URL("./", import.meta.url),
        },
      },
    );
    test(
      "write_file/13_write_json",
      () => {
        writeFileSync(
          new URL("./data.json", import.meta.url),
          JSON.stringify(
            {
              url: import.meta.url,
              timings: {
                a: 100,
              },
            },
            null,
            "  ",
          ),
        );
      },
      {
        filesystemEffects: {
          baseDirectory: new URL("./", import.meta.url),
        },
      },
    );
  }
  group_write_by_directory: {
    test(
      "write_group/0_write_in_one_dir",
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
        },
      },
    );
    test(
      "write_group/1_write_in_2_dir",
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
        },
      },
    );
    test(
      "write_group/2_write_no_out",
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
          textualFilesInline: true,
          baseDirectory: new URL("./", import.meta.url),
        },
      },
    );
  }
});
