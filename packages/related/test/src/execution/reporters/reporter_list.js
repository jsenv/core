import { memoryUsage as processMemoryUsage } from "node:process";
import stripAnsi from "strip-ansi";
import { writeFileSync } from "@jsenv/filesystem";
import {
  createDynamicLog,
  humanizeDuration,
  humanizeMemory,
  ANSI,
  UNICODE,
} from "@jsenv/humanize";
import { urlToFileSystemPath } from "@jsenv/urls";

import { formatErrorForTerminal } from "../format_error_for_terminal.js";

/*
 *                                 label
 *           ┌───────────────────────┴────────────────────────────────┐
 *           │                               │                        │
 *       description                     runtime info                 │
 *  ┌────────┴─────────┐               ┌─────┴───────┐                │
 *  │                  │               │       │     │                │
 * icon number        file            group duration memory intermediate summary
 * ┌┴┐┌───┴─┐ ┌────────┴─────────┐ ┌───┴────┐┌─┴─┐ ┌─┴──┐  ┌──────────┴──────────┐
 *  ✔ 001/100 tests/file.test.html [chromium/10.4s/14.5MB] (2 completed, 1 failed)
 *  ------- console (i1 ✖1) -------
 *  i info
 *  ✖ error
 *  -------------------------------
 *  ---------- error -------
 *  1 | throw new Error("test");
 *      ^
 *  Error: test
 *    at file://demo/file.test.js:1:1
 *  ------------------------
 */

export const reporterList = ({
  animated = true,
  mockFluctuatingValues, // used for snapshot testing logs
  platformInfo,
  memoryUsage,
  cpuUsage,
  spy = () => {
    return {
      write: (log) => {
        process.stdout.write(log);
      },
      end: () => {},
    };
  },
  fileUrl,
}) => {
  const animatedLogEnabled =
    animated &&
    // canEraseProcessStdout
    process.stdout.isTTY &&
    // if there is an error during execution npm will mess up the output
    // (happens when npm runs several command in a workspace)
    // so we enable hot replace only when !process.exitCode (no error so far)
    process.exitCode !== 1;

  const logOptions = {
    platformInfo,
    memoryUsage,
    cpuUsage,
    mockFluctuatingValues,
    group: false,
    intermediateSummary: !animatedLogEnabled,
  };

  let startMs = Date.now();

  const reporters = [
    {
      reporter: "list",
      beforeAll: async (testPlanResult) => {
        let spyReturnValue = await spy();
        let write = spyReturnValue.write;
        let end = spyReturnValue.end;
        spyReturnValue = undefined;

        logOptions.group = Object.keys(testPlanResult.groups).length > 1;
        write(renderIntro(testPlanResult, logOptions));
        if (!animatedLogEnabled) {
          return {
            afterEachInOrder: (execution) => {
              const log = renderExecutionLog(execution, logOptions);
              write(log);
            },
            afterAll: async () => {
              await write(renderOutro(testPlanResult, logOptions));
              write = undefined;
              if (end) {
                await end();
                end = undefined;
              }
            },
          };
        }

        let dynamicLog = createDynamicLog({
          stream: { write },
        });
        const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
        let frameIndex = 0;
        let oneExecutionWritten = false;
        const renderDynamicLog = (testPlanResult) => {
          frameIndex = frameIndex === frames.length - 1 ? 0 : frameIndex + 1;
          let dynamicLogContent = "";
          dynamicLogContent += `${frames[frameIndex]} `;
          dynamicLogContent += renderStatusRepartition(
            testPlanResult.counters,
            {
              showProgression: true,
            },
          );

          const msEllapsed = Date.now() - startMs;
          const infos = [];
          const duration = humanizeDuration(msEllapsed, {
            short: true,
            decimals: 0,
            rounded: false,
          });
          infos.push(ANSI.color(duration, ANSI.GREY));
          const memoryHeapUsed = processMemoryUsage().heapUsed;
          const memoryHeapUsedFormatted = humanizeMemory(memoryHeapUsed, {
            short: true,
            decimals: 0,
          });
          infos.push(ANSI.color(memoryHeapUsedFormatted, ANSI.GREY));

          const infoFormatted = infos.join(ANSI.color(`/`, ANSI.GREY));
          dynamicLogContent += ` ${ANSI.color(
            "[",
            ANSI.GREY,
          )}${infoFormatted}${ANSI.color("]", ANSI.GREY)}`;

          if (oneExecutionWritten) {
            dynamicLogContent = `\n${dynamicLogContent}`;
          }
          dynamicLogContent = `${dynamicLogContent}\n`;
          return dynamicLogContent;
        };
        dynamicLog.update(renderDynamicLog(testPlanResult));
        const interval = setInterval(() => {
          dynamicLog.update(renderDynamicLog(testPlanResult));
        }, 150);

        return {
          warn: (warning) => {
            dynamicLog.clearDuringFunctionCall(() => {
              console.warn(warning.message);
            });
          },
          afterEachInOrder: (execution) => {
            oneExecutionWritten = true;
            dynamicLog.clearDuringFunctionCall(
              () => {
                const log = renderExecutionLog(execution, logOptions);
                write(log);
              },
              // regenerate the dynamic log to put the leading "\n"
              // because of oneExecutionWritten becoming true
              renderDynamicLog(testPlanResult),
            );
          },
          afterAll: async () => {
            dynamicLog.update("");
            dynamicLog.destroy();
            dynamicLog = null;
            clearInterval(interval);
            await write(renderOutro(testPlanResult, logOptions));
            write = undefined;
            await end();
            end = undefined;
          },
        };
      },
    },
  ];

  if (animated && fileUrl) {
    reporters.push(
      reporterList({
        animated: false,
        platformInfo,
        memoryUsage,
        cpuUsage,
        mockFluctuatingValues, // used for snapshot testing logs
        spy: () => {
          let rawOutput = "";

          return {
            write: (log) => {
              rawOutput += stripAnsi(log);
              writeFileSync(fileUrl, rawOutput);
            },
            afterAll: () => {},
          };
        },
      }),
    );
  }

  return reporters;
};

const renderIntro = (testPlanResult, logOptions) => {
  const lines = [];
  if (logOptions.platformInfo) {
    os_line: {
      let osLine = `os: `;
      if (logOptions.mockFluctuatingValues) {
        osLine += `os@<mock>`;
      } else {
        osLine += `${testPlanResult.os.name}@${testPlanResult.os.version}`;
      }
      osLine += renderDetails({
        cpu: logOptions.mockFluctuatingValues
          ? "<mock>"
          : testPlanResult.os.availableCpu,
        memory: logOptions.mockFluctuatingValues
          ? "<mock>GB"
          : humanizeMemory(testPlanResult.os.availableMemory, {
              short: true,
              decimals: 0,
            }),
      });
      lines.push(osLine);
    }
    process_line: {
      const process = logOptions.mockFluctuatingValues
        ? `node@mock`
        : `${testPlanResult.process.name}@${testPlanResult.process.version}`;
      let processLine = `process: ${process}`;
      lines.push(processLine);
    }
  }

  const directory = logOptions.mockFluctuatingValues
    ? "/mock/"
    : urlToFileSystemPath(testPlanResult.rootDirectoryUrl);
  const numberOfFiles = Object.keys(testPlanResult.results).length;
  let fileFoundLine = "";
  if (numberOfFiles === 0) {
    fileFoundLine += `no file matching "testPlan" in ${directory}:
${testPlanResult.patterns.join("\n")}`;
  } else if (numberOfFiles === 1) {
    fileFoundLine += `1 file matching "testPlan" in ${directory}`;
  } else {
    fileFoundLine += `${numberOfFiles} files matching "testPlan" in ${directory}`;
  }

  // TODO: an option to log how many cpu, memory etc we'll use?

  lines.push(fileFoundLine);

  return `${renderBigSection({
    title: "execution start",
    content: lines.join("\n"),
  })}\n\n`;
};

const renderExecutionLog = (execution, logOptions) => {
  let log = "";
  // label
  {
    const label = renderExecutionLabel(execution, logOptions);
    log += label;
  }
  // console calls
  {
    const { consoleCalls = [] } = execution.result;
    const consoleOutput = renderConsole(consoleCalls);
    if (consoleOutput) {
      log += `\n${consoleOutput}`;
    }
  }
  // errors
  {
    const errorOutput = renderErrors(execution, logOptions);
    if (errorOutput) {
      log += `\n${errorOutput}`;
    }
  }
  // const { columns = 80 } = process.stdout;
  // log = wrapAnsi(log, columns, {
  //   trim: false,
  //   hard: true,
  //   wordWrap: false,
  // });
  return `${log}\n`;
};

const renderExecutionLabel = (execution, logOptions) => {
  let label = "";

  // description
  {
    const description =
      descriptionFormatters[execution.result.status](execution);
    label += description;
  }
  // runtimeInfo
  {
    const infos = [];
    if (logOptions.group) {
      infos.push(ANSI.color(execution.group, ANSI.GREY));
    }
    const { timings, memoryUsage } = execution.result;
    if (timings) {
      const duration = timings.executionEnd - timings.executionStart;
      const durationFormatted = logOptions.mockFluctuatingValues
        ? `<mock>ms`
        : humanizeDuration(duration, { short: true });
      infos.push(ANSI.color(durationFormatted, ANSI.GREY));
    }
    if (logOptions.memoryUsage && typeof memoryUsage === "number") {
      const memoryUsageFormatted = logOptions.mockFluctuatingValues
        ? `<mock>MB`
        : humanizeMemory(memoryUsage, { short: true });
      infos.push(ANSI.color(memoryUsageFormatted, ANSI.GREY));
    }
    if (infos.length) {
      const runtimeInfo = infos.join(ANSI.color(`/`, ANSI.GREY));
      label += ` ${ANSI.color("[", ANSI.GREY)}${runtimeInfo}${ANSI.color(
        "]",
        ANSI.GREY,
      )}`;
    }
  }
  // intersummary
  if (logOptions.intermediateSummary) {
    let intermediateSummary = "";
    intermediateSummary += renderStatusRepartition(execution.countersInOrder);
    label += ` (${intermediateSummary})`;
  }

  return label;
};
const descriptionFormatters = {
  executing: ({ fileRelativeUrl }) => {
    return ANSI.color(`${fileRelativeUrl}`, COLOR_EXECUTING);
  },
  aborted: ({ index, countersInOrder, fileRelativeUrl }) => {
    const total = countersInOrder.planified;
    const number = fillLeft(index + 1, total, "0");

    return ANSI.color(
      `${UNICODE.FAILURE_RAW} ${number}/${total} ${fileRelativeUrl}`,
      COLOR_ABORTED,
    );
  },
  timedout: ({ index, countersInOrder, fileRelativeUrl, params }) => {
    const total = countersInOrder.planified;
    const number = fillLeft(index + 1, total, "0");

    return ANSI.color(
      `${UNICODE.FAILURE_RAW} ${number}/${total} ${fileRelativeUrl} timeout after ${params.allocatedMs}ms`,
      COLOR_TIMEOUT,
    );
  },
  failed: ({ index, countersInOrder, fileRelativeUrl }) => {
    const total = countersInOrder.planified;
    const number = fillLeft(index + 1, total, "0");

    return ANSI.color(
      `${UNICODE.FAILURE_RAW} ${number}/${total} ${fileRelativeUrl}`,
      COLOR_FAILED,
    );
  },
  completed: ({ index, countersInOrder, fileRelativeUrl }) => {
    const total = countersInOrder.planified;
    const number = fillLeft(index + 1, total, "0");

    return ANSI.color(
      `${UNICODE.OK_RAW} ${number}/${total} ${fileRelativeUrl}`,
      COLOR_COMPLETED,
    );
  },
  cancelled: ({ index, countersInOrder, fileRelativeUrl }) => {
    const total = countersInOrder.planified;
    const number = fillLeft(index + 1, total, "0");

    return ANSI.color(
      `${UNICODE.FAILURE_RAW} ${number}/${total} ${fileRelativeUrl}`,
      COLOR_CANCELLED,
    );
  },
};

const COLOR_EXECUTING = ANSI.BLUE;
const COLOR_ABORTED = ANSI.MAGENTA;
const COLOR_TIMEOUT = ANSI.MAGENTA;
const COLOR_FAILED = ANSI.RED;
const COLOR_COMPLETED = ANSI.GREEN;
const COLOR_CANCELLED = ANSI.GREY;
const fillLeft = (value, biggestValue, char = " ") => {
  const width = String(value).length;
  const biggestWidth = String(biggestValue).length;
  let missingWidth = biggestWidth - width;
  let padded = "";
  while (missingWidth--) {
    padded += char;
  }
  padded += value;
  return padded;
};
// const fillRight = (value, biggestValue, char = " ") => {
//   const width = String(value).length;
//   const biggestWidth = String(biggestValue).length;
//   let missingWidth = biggestWidth - width;
//   let padded = "";
//   padded += value;
//   while (missingWidth--) {
//     padded += char;
//   }
//   return padded;
// };

const renderConsole = (consoleCalls) => {
  if (consoleCalls.length === 0) {
    return "";
  }
  const consoleRepartition = {
    debug: 0,
    info: 0,
    warning: 0,
    error: 0,
    log: 0,
  };
  consoleCalls.forEach((consoleCall) => {
    consoleRepartition[consoleCall.type]++;
  });
  const consoleOutput = renderConsoleOutput(consoleCalls);
  const consoleSummary = renderConsoleSummary(consoleRepartition);
  return renderSection({
    title: consoleSummary,
    content: consoleOutput,
  });
};
const renderConsoleSummary = (consoleRepartition) => {
  const { debug, info, warning, error } = consoleRepartition;
  const parts = [];
  if (error) {
    parts.push(`${CONSOLE_ICONS.error} ${error}`);
  }
  if (warning) {
    parts.push(`${CONSOLE_ICONS.warning} ${warning}`);
  }
  if (info) {
    parts.push(`${CONSOLE_ICONS.info} ${info}`);
  }
  if (debug) {
    parts.push(`${CONSOLE_ICONS.debug} ${debug}`);
  }
  if (parts.length === 0) {
    return `console`;
  }
  return `console (${parts.join(" ")})`;
};
const renderConsoleOutput = (consoleCalls) => {
  // inside Node.js you can do process.stdout.write()
  // and in that case the consoleCall is not suffixed with "\n"
  // we want to keep these calls together in the output
  const regroupedCalls = [];
  consoleCalls.forEach((consoleCall, index) => {
    if (index === 0) {
      regroupedCalls.push(consoleCall);
      return;
    }
    const previousCall = consoleCalls[index - 1];
    if (previousCall.type !== consoleCall.type) {
      regroupedCalls.push(consoleCall);
      return;
    }
    if (previousCall.text.endsWith("\n")) {
      regroupedCalls.push(consoleCall);
      return;
    }
    if (previousCall.text.endsWith("\r")) {
      regroupedCalls.push(consoleCall);
      return;
    }
    const previousRegroupedCallIndex = regroupedCalls.length - 1;
    const previousRegroupedCall = regroupedCalls[previousRegroupedCallIndex];
    previousRegroupedCall.text = `${previousRegroupedCall.text}${consoleCall.text}`;
  });

  let consoleOutput = ``;
  regroupedCalls.forEach((regroupedCall, index) => {
    const text = regroupedCall.text;
    const textFormatted = prefixFirstAndIndentRemainingLines({
      prefix: CONSOLE_ICONS[regroupedCall.type],
      text,
      trimLines: false,
      trimLastLine: index === regroupedCalls.length - 1,
    });
    consoleOutput += textFormatted;
  });
  return consoleOutput;
};
const prefixFirstAndIndentRemainingLines = ({
  prefix,
  indentation = "  ",
  text,
  trimLines,
  trimLastLine,
}) => {
  const lines = text.split(/\r?\n/);
  const firstLine = lines.shift();
  let result = `${prefix} ${firstLine}`;
  let i = 0;
  while (i < lines.length) {
    const line = trimLines ? lines[i].trim() : lines[i];
    i++;
    result += line.length
      ? `\n${indentation}${line}`
      : trimLastLine && i === lines.length
        ? ""
        : `\n`;
  }
  return result;
};
const CONSOLE_ICONS = {
  get debug() {
    return UNICODE.DEBUG;
  },
  get info() {
    return UNICODE.INFO;
  },
  get warning() {
    return UNICODE.WARNING;
  },
  get error() {
    return UNICODE.FAILURE;
  },
  log: " ",
};

const renderErrors = (execution, logOptions) => {
  const { errors = [] } = execution.result;
  if (errors.length === 0) {
    return "";
  }

  if (errors.length === 1) {
    return renderSection({
      dashColor: ANSI.GREY,
      title: "error",
      content: formatErrorForTerminal(errors[0], {
        rootDirectoryUrl: execution.rootDirectoryUrl,
        mainFileRelativeUrl: execution.fileRelativeUrl,
        mockFluctuatingValues: logOptions.mockFluctuatingValues,
        tryColors: true,
      }),
    });
  }

  let output = [];
  errors.forEach((error) => {
    output.push(
      prefixFirstAndIndentRemainingLines({
        prefix: `${UNICODE.CIRCLE_CROSS} `,
        indentation: "   ",
        text: formatErrorForTerminal(error, {
          rootDirectoryUrl: execution.rootDirectoryUrl,
          mainFileRelativeUrl: execution.fileRelativeUrl,
          mockFluctuatingValues: logOptions.mockFluctuatingValues,
          tryColors: true,
        }),
      }),
    );
  });
  return renderSection({
    dashColor: ANSI.GREY,
    title: `errors (${errors.length})`,
    content: output.join(`\n`),
  });
};

const renderOutro = (testPlanResult, logOptions = {}) => {
  return `\n${renderBigSection({
    title: "execution end",
    content: renderOutroContent(testPlanResult, logOptions),
  })}\n`;
};

export const renderOutroContent = (testPlanResult, logOptions = {}) => {
  const lines = [];
  const { counters } = testPlanResult;
  const { planified } = counters;

  let executionLine = "";
  if (planified === 0) {
    executionLine += `no execution`;
  } else if (planified === 1) {
    executionLine += `1 execution: `;
  } else {
    executionLine += `${planified} executions: `;
  }
  executionLine += renderStatusRepartition(counters);
  lines.push(executionLine);

  let durationLine = `duration: `;
  const { timings } = testPlanResult;
  if (logOptions.mockFluctuatingValues) {
    durationLine += "<mock>s";
  } else {
    durationLine += humanizeDuration(timings.end, { short: true });
    const namedTimings = {
      setup: humanizeTiming(timings.executionStart),
      execution: humanizeTiming(timings.executionEnd),
      teardown: humanizeTiming(timings.teardownEnd - timings.executionEnd),
      ...(testPlanResult.coverage
        ? {
            coverage: humanizeTiming(
              timings.coverageTeardownEnd - timings.teardownEnd,
            ),
          }
        : {}),
    };
    durationLine += renderDetails(namedTimings);
  }
  lines.push(durationLine);

  if (logOptions.cpuUsage) {
    const processCpuUsage = testPlanResult.cpuUsage.process;
    let cpuUsageLine = "cpu: ";
    cpuUsageLine += `${humanizeProcessCpuUsage(processCpuUsage.end)}`;
    cpuUsageLine += renderDetails({
      med: humanizeProcessCpuUsage(processCpuUsage.median),
      min: humanizeProcessCpuUsage(processCpuUsage.min),
      max: humanizeProcessCpuUsage(processCpuUsage.max),
    });
    lines.push(cpuUsageLine);
  }
  if (logOptions.memoryUsage) {
    const processMemoryUsage = testPlanResult.memoryUsage.process;
    let memoryUsageLine = "memory: ";
    memoryUsageLine += `${humanizeProcessMemoryUsage(processMemoryUsage.end)}`;
    memoryUsageLine += renderDetails({
      med: humanizeProcessMemoryUsage(processMemoryUsage.median),
      min: humanizeProcessMemoryUsage(processMemoryUsage.min),
      max: humanizeProcessMemoryUsage(processMemoryUsage.max),
    });
    lines.push(memoryUsageLine);
  }
  return lines.join("\n");
};

const humanizeTiming = (value) => {
  return humanizeDuration(value, { short: true });
};

const humanizeProcessCpuUsage = (ratio) => {
  const percentageAsNumber = ratio * 100;
  const percentageAsNumberRounded = Math.round(percentageAsNumber);
  const percentage = `${percentageAsNumberRounded}%`;
  return percentage;
};

const humanizeProcessMemoryUsage = (value) => {
  return humanizeMemory(value, { short: true, decimals: 0 });
};

const renderStatusRepartition = (counters, { showProgression } = {}) => {
  if (counters.planified === 0) {
    return ``;
  }
  if (counters.aborted === counters.planified) {
    return `all ${ANSI.color(`aborted`, COLOR_ABORTED)}`;
  }
  if (counters.timedout === counters.planified) {
    return `all ${ANSI.color(`timed out`, COLOR_TIMEOUT)}`;
  }
  if (counters.failed === counters.planified) {
    return `all ${ANSI.color(`failed`, COLOR_FAILED)}`;
  }
  if (counters.completed === counters.planified) {
    return `all ${ANSI.color(`completed`, COLOR_COMPLETED)}`;
  }
  if (counters.cancelled === counters.planified) {
    return `all ${ANSI.color(`cancelled`, COLOR_CANCELLED)}`;
  }
  const parts = [];
  if (counters.timedout) {
    parts.push(
      `${counters.timedout} ${ANSI.color(`timed out`, COLOR_TIMEOUT)}`,
    );
  }
  if (counters.failed) {
    parts.push(`${counters.failed} ${ANSI.color(`failed`, COLOR_FAILED)}`);
  }
  if (counters.completed) {
    parts.push(
      `${counters.completed} ${ANSI.color(`completed`, COLOR_COMPLETED)}`,
    );
  }
  if (counters.aborted) {
    parts.push(`${counters.aborted} ${ANSI.color(`aborted`, COLOR_ABORTED)}`);
  }
  if (counters.cancelled) {
    parts.push(
      `${counters.cancelled} ${ANSI.color(`cancelled`, COLOR_CANCELLED)}`,
    );
  }
  if (showProgression) {
    if (counters.executing) {
      parts.push(`${counters.executing} executing`);
    }
    if (counters.waiting) {
      parts.push(`${counters.waiting} waiting`);
    }
  }
  return `${parts.join(", ")}`;
};

const renderBigSection = (params) => {
  return renderSection({
    width: 45,
    ...params,
  });
};

const renderSection = ({
  title,
  content,
  dashColor = ANSI.GREY,
  width = 38,
}) => {
  let section = "";

  const titleWidth = stripAnsi(title).length;
  const minWidthRequired = `--- … ---`.length;
  const needsTruncate = titleWidth + minWidthRequired >= width;
  if (needsTruncate) {
    const titleTruncated = title.slice(0, width - minWidthRequired);
    const leftDashes = ANSI.color("---", dashColor);
    const rightDashes = ANSI.color("---", dashColor);
    section += `${leftDashes} ${titleTruncated}… ${rightDashes}`;
  } else {
    const remainingWidth = width - titleWidth - 2; // 2 for spaces around the title
    const dashLeftCount = Math.floor(remainingWidth / 2);
    const dashRightCount = remainingWidth - dashLeftCount;
    const leftDashes = ANSI.color("-".repeat(dashLeftCount), dashColor);
    const rightDashes = ANSI.color("-".repeat(dashRightCount), dashColor);
    section += `${leftDashes} ${title} ${rightDashes}`;
  }
  section += `\n${content}\n`;
  const bottomDashes = ANSI.color(`-`.repeat(width), dashColor);
  section += bottomDashes;
  return section;
};

const renderDetails = (data) => {
  const details = [];
  for (const key of Object.keys(data)) {
    const value = data[key];
    let valueString = "";
    valueString += ANSI.color(`${key}:`, ANSI.GREY);
    const useNonGreyAnsiColor =
      typeof value === "string" && value.includes("\x1b");
    valueString += " ";
    valueString += useNonGreyAnsiColor ? value : ANSI.color(value, ANSI.GREY);
    details.push(valueString);
  }
  if (details.length === 0) {
    return "";
  }

  let string = "";
  string += ` ${ANSI.color("(", ANSI.GREY)}`;
  string += details.join(ANSI.color(", ", ANSI.GREY));
  string += ANSI.color(")", ANSI.GREY);
  return string;
};
