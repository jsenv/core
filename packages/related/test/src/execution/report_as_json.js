import { assertAndNormalizeFileUrl, writeFileSync } from "@jsenv/filesystem";
import { urlToFileSystemPath } from "@jsenv/urls";

import { replaceUrls } from "./replace_urls.js";

export const reportAsJson = (
  testPlanResult,
  fileUrl,
  { mockFluctuatingValues } = {},
) => {
  fileUrl = assertAndNormalizeFileUrl(fileUrl);

  if (!mockFluctuatingValues) {
    writeFileSync(fileUrl, JSON.stringify(testPlanResult, null, "  "));
    return;
  }
  const testPlanResultCopy = deepCopy(testPlanResult, {});
  testPlanResultCopy.os.name = "<mock>";
  testPlanResultCopy.os.version = "<mock>";
  testPlanResultCopy.os.availableCpu = "<mock>";
  testPlanResultCopy.os.availableMemory = "<mock>";
  testPlanResultCopy.process.version = "<mock>";
  testPlanResultCopy.memoryUsage = "<mock>";
  testPlanResultCopy.cpuUsage = "<mock>";
  testPlanResultCopy.rootDirectoryUrl = "/mock/";
  testPlanResultCopy.timings = "<mock>";
  for (const group of Object.keys(testPlanResultCopy.groups)) {
    testPlanResultCopy.groups[group].runtimeVersion = "<mock>";
  }

  for (const relativeUrl of Object.keys(testPlanResultCopy.results)) {
    const fileResults = testPlanResultCopy.results[relativeUrl];
    for (const groupName of Object.keys(fileResults)) {
      const executionResult = fileResults[groupName];
      const { consoleCalls } = executionResult;
      if (consoleCalls) {
        for (const consoleCall of consoleCalls) {
          consoleCall.text = mockFluctuatingValuesInMessage(consoleCall.text, {
            rootDirectoryUrl: testPlanResult.rootDirectoryUrl,
          });
          consoleCall.text = consoleCall.text.replace(/\r\n/g, "\n");
        }
      }
      const { errors } = executionResult;
      if (errors) {
        for (const error of errors) {
          if (error.message) {
            error.message = mockFluctuatingValuesInMessage(error.message, {
              rootDirectoryUrl: testPlanResult.rootDirectoryUrl,
            });
          }
          if (error.stack) {
            error.stack = mockFluctuatingValuesInMessage(error.stack, {
              rootDirectoryUrl: testPlanResult.rootDirectoryUrl,
            });
          }
        }
      }
      if (executionResult.timings) {
        executionResult.timings = "<mock>";
      }
      if (Object.hasOwn(executionResult, "memoryUsage")) {
        executionResult.memoryUsage = "<mock>";
      }
      if (executionResult.performance) {
        executionResult.performance = "<mock>";
      }
      if (executionResult.coverageFileUrl) {
        executionResult.coverageFileUrl = "<mock>";
      }
    }
  }
  writeFileSync(fileUrl, JSON.stringify(testPlanResultCopy, null, "  "));
};

const mockFluctuatingValuesInMessage = (message, { rootDirectoryUrl }) => {
  return replaceUrls(message, ({ url, line, column }) => {
    let urlAsPath = String(url).startsWith("file:")
      ? urlToFileSystemPath(url)
      : url;
    const rootDirectoryPath = urlToFileSystemPath(rootDirectoryUrl);
    urlAsPath = urlAsPath.replace(rootDirectoryPath, "/mock/");
    if (process.platform === "win32") {
      urlAsPath = urlAsPath.replace(/\\/g, "/");
    }
    if (typeof line === "number" && typeof column === "number") {
      return `${urlAsPath}:${line}:${column}`;
    }
    if (typeof line === "number") {
      return `${urlAsPath}:${line}`;
    }
    return urlAsPath;
  });
};

const deepCopy = (from, into) => {
  const copyValue = (value) => {
    if (value === null) {
      return null;
    }
    if (typeof value === "object") {
      if (Array.isArray(value)) {
        return deepCopy(value, []);
      }
      return deepCopy(value, {});
    }
    return value;
  };

  if (Array.isArray(from)) {
    let i = 0;
    while (i < from.length) {
      into[i] = copyValue(from[i]);
      i++;
    }
  }
  for (const key of Object.keys(from)) {
    into[key] = copyValue(from[key]);
  }
  return into;
};
