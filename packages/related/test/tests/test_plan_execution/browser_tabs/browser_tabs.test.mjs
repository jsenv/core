/*
 * The goal is to ensure test plan execution in browser tabs works without errors
 */

import { takeFileSnapshot } from "@jsenv/snapshot";
import { startDevServer } from "@jsenv/core";
import { writeFileSync } from "@jsenv/filesystem";

import { executeTestPlan, chromium } from "@jsenv/test";

const testResultJsonFileUrl = new URL(
  "./snapshots/test_result.json",
  import.meta.url,
);
const testResultJsonSnapshot = takeFileSnapshot(testResultJsonFileUrl);
const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});
const result = await executeTestPlan({
  logs: {
    level: "warn",
  },
  rootDirectoryUrl: new URL("./", import.meta.url),
  testPlan: {
    "./client/*.html": {
      a: {
        runtime: chromium(),
      },
      b: {
        runtime: chromium(),
      },
    },
  },
  webServer: {
    origin: devServer.origin,
    rootDirectoryUrl: new URL("./client/", import.meta.url),
  },
  githubCheck: false,
});
result.os.name = "<mock>";
result.os.version = "<mock>";
result.os.availableCpu = "<mock>";
result.os.availableMemory = "<mock>Gb";
result.process.name = "<mock>";
result.process.version = "<mock>";
for (const key of Object.keys(result.memoryUsage.os)) {
  result.memoryUsage.os[key] = "<mock>";
}
for (const key of Object.keys(result.memoryUsage.process)) {
  result.memoryUsage.process[key] = "<mock>";
}
for (const key of Object.keys(result.cpuUsage.os)) {
  result.cpuUsage.os[key] = "<mock>";
}
for (const key of Object.keys(result.cpuUsage.process)) {
  result.cpuUsage.process[key] = "<mock>";
}
for (const key of Object.keys(result.timings)) {
  result.timings[key] = "<mock>";
}
result.rootDirectoryUrl = "/mock/";
for (const group of Object.keys(result.groups)) {
  result.groups[group].runtimeVersion = "<mock>";
}
for (const relativeUrl of Object.keys(result.results)) {
  const fileExecutionResults = result.results[relativeUrl];
  for (const group of Object.keys(fileExecutionResults)) {
    const executionResult = fileExecutionResults[group];
    for (const key of Object.keys(executionResult.timings)) {
      executionResult.timings[key] = "<mock>";
    }
    if (executionResult.memoryUsage) {
      executionResult.memoryUsage = "<mock>";
    }
  }
}

writeFileSync(testResultJsonFileUrl, JSON.stringify(result, null, "  "));
testResultJsonSnapshot.compare();
