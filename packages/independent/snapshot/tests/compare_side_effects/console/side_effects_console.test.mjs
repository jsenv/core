import { snapshotFunctionSideEffects } from "@jsenv/snapshot";

snapshotFunctionSideEffects(
  () => {
    console.log("Hello");
    return 42;
  },
  new URL("./output/0_log_and_return_42.md", import.meta.url),
);
snapshotFunctionSideEffects(
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
snapshotFunctionSideEffects(
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
