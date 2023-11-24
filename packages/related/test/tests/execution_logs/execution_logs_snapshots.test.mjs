import stripAnsi from "strip-ansi";
import { writeFileSync } from "@jsenv/filesystem";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

import { createExecutionLog } from "@jsenv/test/src/execution/logs_file_execution.js";

if (process.platform === "win32") {
  // windows does not use same unicode chars
  process.exit(0);
}

const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);
const test = (name, data, options) => {
  const snapshotFileUrl = new URL(name, snapshotsDirectoryUrl);
  const logRaw = stripAnsi(
    createExecutionLog(data, {
      logRuntime: true,
      logEachDuration: true,
      ...options,
    }),
  );
  writeFileSync(snapshotFileUrl, logRaw);
};

const directorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
test(
  "1_over_2_executing.txt",
  {
    executionIndex: 0,
    fileRelativeUrl: "file.js",
    runtimeName: "chrome",
    runtimeVersion: "10.0.0",
    executionResult: {
      status: "executing",
    },
    startMs: 1000,
    nowMs: 2000,
    counters: {
      total: 2,
      aborted: 0,
      timedout: 0,
      failed: 0,
      completed: 0,
      done: 0,
    },
  },
  {},
);
test(
  "1_over_2_aborted.txt",
  {
    executionIndex: 0,
    fileRelativeUrl: "file.js",
    runtimeName: "chrome",
    runtimeVersion: "10.0.0",
    executionResult: {
      status: "aborted",
    },
    startMs: 10,
    endMs: 20,
    counters: {
      total: 2,
      aborted: 1,
      timedout: 0,
      failed: 0,
      completed: 0,
      done: 0,
    },
  },
  {},
);
test(
  "1_over_2_timeout.txt",
  {
    executionIndex: 0,
    fileRelativeUrl: "file.js",
    runtimeName: "chrome",
    runtimeVersion: "10.0.0",
    executionResult: { status: "timedout" },
    executionParams: { allocatedMs: 100 },
    startMs: 10,
    endMs: 20,
    counters: {
      total: 2,
      aborted: 0,
      timedout: 1,
      failed: 0,
      completed: 0,
      done: 0,
    },
  },
  {},
);
test("1_over_2_failed.txt", {
  executionIndex: 0,
  fileRelativeUrl: "file.js",
  runtimeName: "chrome",
  runtimeVersion: "10.0.0",
  executionResult: {
    status: "failed",
    errors: [
      {
        stack: `AssertionError: unequal values
--- found ---
false
--- expected ---
true
--- path ---
actual.foo
  at node_modules/@jsenv/assert/src/main.js:10:3`,
      },
    ],
  },
  startMs: 10,
  endMs: 20,
  counters: {
    total: 2,
    aborted: 0,
    timedout: 0,
    failed: 1,
    completed: 0,
    done: 0,
  },
});
test(
  "1_over_2_completed.txt",
  {
    executionIndex: 0,
    fileRelativeUrl: "file.js",
    runtimeName: "chrome",
    runtimeVersion: "10.0.0",
    executionResult: { status: "completed" },
    startMs: 10,
    endMs: 20,
    counters: {
      total: 2,
      aborted: 0,
      timedout: 0,
      failed: 0,
      completed: 1,
      done: 0,
    },
  },
  {},
);
directorySnapshot.compare();
