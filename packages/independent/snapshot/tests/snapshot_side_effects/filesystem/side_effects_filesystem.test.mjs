import {
  readFile,
  readFileSync,
  writeDirectory,
  writeDirectorySync,
  writeFile,
  writeFileSync,
} from "@jsenv/filesystem";
import { snapshotSideEffects, takeDirectorySnapshot } from "@jsenv/snapshot";
import {
  copyFile as copyFileNode,
  copyFileSync as copyFileSyncNode,
  existsSync,
  renameSync,
} from "node:fs";

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
  const resultDirectorySnapshot = takeDirectorySnapshot(
    new URL("./result/", import.meta.url),
  );
  const activeScenarioMap = onlyScenarioMap.size
    ? onlyScenarioMap
    : scenarioMap;
  for (const [scenario, { fn, options }] of activeScenarioMap) {
    await snapshotSideEffects(import.meta.url, fn, {
      sideEffectMdFileUrl: new URL(`./result/${scenario}.md`, import.meta.url),
      outFilePattern: `./result/${scenario}/[filename]`,
      ...options,
    });
  }
  resultDirectorySnapshot.compare();
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
      writeDirectorySync(new URL("./out/dir_sync/", import.meta.url));
      return existsSync(new URL("./out/dir_sync/", import.meta.url));
    });
    test("write_dir/1_write_directory_async", async () => {
      await writeDirectory(new URL("./out/dir_async/", import.meta.url));
      return existsSync(new URL("./out/dir_async/", import.meta.url));
    });
    test("write_dir/2_write_dir_deep", () => {
      writeDirectorySync(new URL("./out/dir/a/b/c", import.meta.url));
    });
  }
  write_file: {
    test(
      "write_file/0_write_sync",
      () => {
        writeFileSync(
          new URL("./out/toto.txt", import.meta.url),
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
          new URL("./out/toto.txt", import.meta.url),
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
          new URL("./out/toto/toto.txt", import.meta.url),
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
          new URL("./out/toto.txt", import.meta.url),
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
          new URL("./out/toto.txt", import.meta.url),
          "4_write_inside_base",
        );
      },
      {
        filesystemEffects: {
          textualFilesInline: true,
        },
      },
    );
    test("write_file/5_write_inside_base_and_textual_out", () => {
      writeFileSync(
        new URL("./out/toto.txt", import.meta.url),
        "5_write_inside_base_and_textual_out",
      );
    });
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
        },
      },
    );
    test("write_file/7_write_above_base_and_textual_out", () => {
      writeFileSync(
        new URL("../toto.txt", import.meta.url),
        "7_write_above_base_and_out",
      );
    });
    test(
      "write_file/8_write_same_file",
      () => {
        writeFileSync(new URL("./out/toto.txt", import.meta.url), "a");
        writeFileSync(new URL("./out/toto.txt", import.meta.url), "b");
      },
      {
        filesystemEffects: {
          textualFilesInline: true,
        },
      },
    );
    test(
      "write_file/9_write_same_file_again",
      () => {
        writeFileSync(new URL("./out/a.txt", import.meta.url), "a");
        writeFileSync(new URL("./out/b.txt", import.meta.url), "b");
        writeFileSync(new URL("./out/b.txt", import.meta.url), "b");
        writeFileSync(new URL("./out/c.txt", import.meta.url), "c");
      },
      {
        filesystemEffects: {
          textualFilesInline: true,
        },
      },
    );

    test(
      "write_file/10_write_same_file_not_grouped",
      () => {
        writeFileSync(new URL("./out/toto.txt", import.meta.url), "first");
        console.log("hey");
        writeFileSync(new URL("./out/toto.txt", import.meta.url), "second");
      },
      {
        filesystemEffects: {
          textualFilesInline: true,
        },
      },
    );
    test("write_file/11_write_same_file_not_grouped_and_out", () => {
      writeFileSync(new URL("./out/toto.txt", import.meta.url), "first");
      console.log("hey");
      writeFileSync(new URL("./out/toto.txt", import.meta.url), "second");
    });
    test("write_file/12_write_png", () => {
      writeFileSync(
        new URL("./out/jsenv.png", import.meta.url),
        readFileSync(new URL("./input/jsenv.png", import.meta.url)),
      );
    });
    test("write_file/13_write_json", () => {
      writeFileSync(
        new URL("./out/data.json", import.meta.url),
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
    });
  }
  group_write_by_directory: {
    test("write_group/0_write_in_one_dir", () => {
      writeFileSync(new URL("./out/shared/a/a_1.txt", import.meta.url));
      writeFileSync(new URL("./out/shared/a/a_2.txt", import.meta.url));
      writeFileSync(new URL("./out/shared/b/b_1.txt", import.meta.url));
      writeFileSync(new URL("./out/shared/b/b_2.txt", import.meta.url));
      writeFileSync(new URL("./out/shared/b/b_3.txt", import.meta.url));
    });
    test("write_group/1_write_in_2_dir", () => {
      writeFileSync(new URL("./out/a/a_1.txt", import.meta.url));
      writeFileSync(new URL("./out/a/a_2.txt", import.meta.url));
      writeFileSync(new URL("./out/b/b_1.txt", import.meta.url));
      writeFileSync(new URL("./out/b/b_2.txt", import.meta.url));
      writeFileSync(new URL("./out/b/b_3.txt", import.meta.url));
    });
    test(
      "write_group/2_write_no_out",
      () => {
        writeFileSync(new URL("./out/a_1.txt", import.meta.url), "a_1_content");
        writeFileSync(new URL("./out/a_2.txt", import.meta.url), "a_2_content");
      },
      {
        filesystemEffects: {
          textualFilesInline: true,
        },
      },
    );
  }
  copy_file: {
    test("copy_file/0_copy_sync", () => {
      copyFileSyncNode(
        new URL("./input/a.txt", import.meta.url),
        new URL("./out/a.txt", import.meta.url),
      );
    });
    test("copy_file/0_copy_async", async () => {
      await new Promise((resolve, reject) => {
        copyFileNode(
          new URL("./input/a.txt", import.meta.url),
          new URL("./out/a.txt", import.meta.url),
          (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          },
        );
      });
    });
  }
  move_file: {
    test("move_file/0_rename_sync", () => {
      renameSync(
        new URL("./input/a.txt", import.meta.url),
        new URL("./out/a.txt", import.meta.url),
      );
    });
  }
});
