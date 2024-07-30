import { renderLogsGif, snapshotSideEffects } from "@jsenv/snapshot";

snapshotSideEffects(
  () => {
    console.log("Hello");
    return 42;
  },
  new URL("./output/0_log_and_return_42.md", import.meta.url),
);
snapshotSideEffects(
  () => {
    console.log("log_0");
    console.info("info_0");
    console.warn("warn_0");
    console.error("error_0");
    console.log("log_1");
    console.info("info_1");
    console.warn("warn_1");
    console.error("error_1");
  },
  new URL("./output/1_multiple_console_calls.md", import.meta.url),
);
snapshotSideEffects(
  () => {
    console.log("before");
    process.stdout.write("between");
    console.log("after");
  },
  new URL(
    "./output/2_console_log_and_process_stdout_write.md",
    import.meta.url,
  ),
);
snapshotSideEffects(
  () => {
    console.log(
      "[31mred [39m[33myellow [39m[32mgreen [39m[36mcyan [39m[34mblue [39m[35mmagenta[39m",
    );
  },
  new URL("./output/3_console_log_rainbow.md", import.meta.url),
);

snapshotSideEffects(
  () => {
    console.log("[31m_[39m");
    console.log("🤖[31m DANGER[0m Will Robbinson");
  },
  new URL("./output/4_console_ansi_many.md", import.meta.url),
);

snapshotSideEffects(
  () => {
    console.log("a");
    console.info("b");
  },
  new URL("./output/5_console_group.md", import.meta.url),
  {
    logEffects: {
      group: true,
    },
  },
);

const sideEffects = snapshotSideEffects(
  () => {
    console.log("a");
    console.log("b");
  },
  new URL("./output/6_console_gif.md", import.meta.url),
);
await renderLogsGif(
  sideEffects,
  new URL("./output/6_console_gif/terminal.gif", import.meta.url),
);

snapshotSideEffects(
  () => {
    console.log("[31m Hi[0m <toto>");
  },
  new URL("./output/7_console_color_and_html_special_char.md", import.meta.url),
  {
    logEffects: {
      group: true,
    },
  },
);
