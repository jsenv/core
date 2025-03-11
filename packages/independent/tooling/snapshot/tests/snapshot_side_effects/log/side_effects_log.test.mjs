import { snapshotSideEffects, takeDirectorySnapshot } from "@jsenv/snapshot";

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
      sideEffectMdFileUrl: new URL(`./output/${scenario}.md`, import.meta.url),
      outFilePattern: `./output/${scenario}/[filename]`,
      ...options,
    });
  }
  outputDirectorySnapshot.compare();
};

await startTesting(({ test }) => {
  test("0_log_and_return_42", () => {
    console.log("Hello");
    return 42;
  });
  test("1_multiple_console_calls", () => {
    console.log("log_0");
    console.info("info_0");
    console.warn("warn_0");
    console.error("error_0");
    console.log("log_1");
    console.info("info_1");
    console.warn("warn_1");
    console.error("error_1");
  });
  test("2_console_log_and_process_stdout_write", () => {
    console.log("before");
    process.stdout.write("between");
    console.log("after");
  });
  test("3_console_log_rainbow", () => {
    console.log(
      "[31mred [39m[33myellow [39m[32mgreen [39m[36mcyan [39m[34mblue [39m[35mmagenta[39m",
    );
  });
  test("4_console_ansi_many", () => {
    console.log("[31m_[39m");
    console.log("🤖[31m DANGER[0m Will Robbinson");
  });
  test(
    "5_console_group",
    () => {
      console.log("a");
      console.info("b");
    },
    {
      logEffects: {
        group: true,
      },
    },
  );
  test("7_console_color_and_html_special_char", () => {
    console.log("[31m Hi[0m <toto>");
  });
});

// snapshotSideEffects(
//   import.meta.url,
//   () => {
//     console.log("a");
//     console.log("b");
//   },
//   {
//     sideEffectFileUrl: new URL("./output/6_console_gif.md", import.meta.url),
//   },
// );
// await renderLogsGif(
//   sideEffects,
//   new URL("./output/6_console_gif/terminal.gif", import.meta.url),
// );
