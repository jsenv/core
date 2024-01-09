// run prettier on it

// https://github.com/testmoapp/junitxml
// https://llg.cubic.org/docs/junit/

import { assertAndNormalizeFileUrl, writeFileSync } from "@jsenv/filesystem";

import { formatErrorForTerminal } from "../format_error_for_terminal.js";
import { createXmlGenerator } from "./xml_generator.js";

export const reportAsJunitXml = async (
  testPlanResult,
  fileUrl,
  { mockFluctuatingValues } = {},
) => {
  fileUrl = assertAndNormalizeFileUrl(fileUrl);

  const createRootNode = createXmlGenerator({
    rootNodeName: "testsuite",
    canReceiveChildNames: ["testsuite", "testcase", "properties"],
    canReceiveContentNames: ["failure", "error", "system-out", "system-err"],
  });
  const testSuite = createRootNode({
    time: mockFluctuatingValues ? "[mock]" : testPlanResult.timings.end,
    timestamp: mockFluctuatingValues
      ? "[mock]"
      : new Date(testPlanResult.timings.origin).toISOString().slice(0, -5), //  Date and time of when the test run was executed
    tests: testPlanResult.counters.planified,
    skipped:
      testPlanResult.counters.aborted + testPlanResult.counters.cancelled,
    failures: testPlanResult.counters.timedout + testPlanResult.counters.failed, // Total number of failed tests
  });

  for (const fileRelativeUrl of Object.keys(testPlanResult.results)) {
    const fileResults = testPlanResult.results[fileRelativeUrl];
    for (const group of Object.keys(fileResults)) {
      const executionResult = fileResults[group];
      const testCase = testSuite.createNode("testcase", {
        file: fileRelativeUrl,
        name: group,
        time: mockFluctuatingValues ? "[mock]" : executionResult.timings.end, // duration of this execution
        timestamp: mockFluctuatingValues
          ? "[mock]"
          : new Date(executionResult.timings.origin).toISOString().slice(0, -5), //  Date and time of when the test run was executed
        tests: 1, // Total number of tests for this execution
      });
      testSuite.appendChild(testCase);

      if (executionResult.status === "aborted") {
        testCase.attributes.skipped = 1;
        const skipped = testCase.createNode("skipped", {
          message: "Execution was aborted",
        });
        testSuite.appendChild(skipped);
      }
      if (executionResult.status === "timedout") {
        testCase.attributes.failures = 1;
        const failure = testCase.createNode("failure", {
          message: `Execution timeout after ${executionResult.params.allocatedMs}ms"`,
          type: "timeout",
        });
        testSuite.appendChild(failure);
      }
      if (executionResult.status === "failed") {
        const [error] = executionResult.errors;
        if (
          error &&
          typeof error.name === "string" &&
          error.name.includes("AssertionError")
        ) {
          testCase.attributes.failures = 1;
          const failure = testCase.createNode("failure", {
            type: error.name,
          });
          testSuite.appendChild(failure);
          failure.setContent(
            formatErrorForTerminal(error, {
              rootDirectoryUrl: testPlanResult.rootDirectoryUrl,
              mainFileRelativeUrl: fileRelativeUrl,
              mockFluctuatingValues,
              tryColors: false,
            }),
          );
        } else {
          testCase.attributes.errors = 1;
          const errorNode = testCase.createNode("error", {
            type: error.name,
          });
          testSuite.appendChild(errorNode);
          errorNode.setContent(
            formatErrorForTerminal(error, {
              rootDirectoryUrl: testPlanResult.rootDirectoryUrl,
              mainFileRelativeUrl: fileRelativeUrl,
              mockFluctuatingValues,
              tryColors: false,
            }),
          );
        }
      }

      const groupInfo = testPlanResult.groups[group];
      const properties = {
        runtimeName: groupInfo.runtimeName,
        runtimeVersion: groupInfo.runtimeVersion,
      };
      const propertiesNode = testCase.createNode("properties");
      testCase.appendChild(propertiesNode);
      for (const propertyName of Object.keys(properties)) {
        const propertyNode = propertiesNode.createNode("property", {
          name: propertyName,
          value: properties[propertyName],
        });
        propertiesNode.appendChild(propertyNode);
      }

      const { consoleCalls } = executionResult;
      let stdout = "";
      let stderr = "";
      for (const consoleCall of consoleCalls) {
        if (groupInfo.runtimeType === "node") {
          if (consoleCall.type === "error") {
            stdout += consoleCall.text;
          } else {
            stderr += consoleCall.text;
          }
        } else {
          stdout += consoleCall.text;
        }
      }
      if (stdout.length) {
        const systemOut = testSuite.createNode("system-out");
        testCase.appendChild(systemOut);
        systemOut.setContent(stdout);
      }
      if (stderr.length) {
        const systemErr = testSuite.createNode("system-err");
        testCase.appendChild(systemErr);
        systemErr.setContent(stderr);
      }
    }
  }

  let junitXmlFileContent = `<?xml version="1.0" encoding="UTF-8"?>
${testSuite.renderAsString()}`;

  writeFileSync(new URL(fileUrl), junitXmlFileContent);
};
