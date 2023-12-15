import stripAnsi from "strip-ansi";
// import wrapAnsi from "wrap-ansi";
import { writeFileSync } from "@jsenv/filesystem";
import {
  createLog,
  ANSI,
  UNICODE,
  msAsDuration,
  byteAsMemoryUsage,
} from "@jsenv/log";

import { formatErrorForTerminal } from "./format_error_for_terminal.js";

export const listReporter = ({ logger, logs }) => {
  const canEraseProcessStdout =
    logs.dynamic &&
    process.stdout.isTTY &&
    !logger.levels.debug &&
    !logger.levels.info &&
    // if there is an error during execution npm will mess up the output
    // (happens when npm runs several command in a workspace)
    // so we enable hot replace only when !process.exitCode (no error so far)
    process.exitCode !== 1;

  let rawOutput = "";
  const writeOutput = (log) => {
    if (logger.levels.info) {
      process.stdout.write(log);
    }
    rawOutput += stripAnsi(log);
    // ansiOutput += log;
    if (logs.fileUrl) {
      writeFileSync(logs.fileUrl, rawOutput);
    }
  };

  const logOptions = {
    ...logs,
    group: false,
    intermediateSummary: !canEraseProcessStdout,
  };

  return {
    beforeAllExecution: (testPlanInfo) => {
      logOptions.group = Object.keys(testPlanInfo.groups).length > 1;

      writeOutput(renderIntro(testPlanInfo, logOptions));
      if (!canEraseProcessStdout) {
        return () => {
          writeOutput(renderOutro(testPlanInfo, logOptions));
        };
      }

      const dynamicLog = createLog({ newLine: "" });
      const pendingExecutionSet = new Set();
      const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
      let frameIndex = 0;
      const interval = setInterval(() => {
        dynamicLog.write(renderLog());
      }, 50);
      const renderLog = () => {
        frameIndex = frameIndex === frames.length - 1 ? 0 : frameIndex + 1;
        const availableLines = process.stdout.rows;
        const pendingExecutions = Array.from(pendingExecutionSet);
        const pendingExecutionsSubset = pendingExecutions.slice(
          0,
          availableLines,
        );
        const pendingExecutionLogs = pendingExecutionsSubset.map(
          (pendingExecution) => {
            if (pendingExecution.result.status === "pending") {
              // this execution might be over
              // but we want to wait before displaying more info
              // that others before are done
              // otherwise we can't properly update the logs
              // (only for failed execution)
              // (otherwise we could update as line would still take same height)
              // also not when execution contains warning for instance
              pendingExecution.duration = new Date() - pendingExecution.startMs;
            }
            // TODO: append duration and memory usage if enabled and available
            return ANSI.color(
              `executing ${fillLeft(
                pendingExecution.index + 1,
                pendingExecution.total,
                "0",
              )} of ${pendingExecution.total}`,
              ANSI.BLUE,
            );
          },
        );
        return pendingExecutionLogs.join("\n");
      };
      return () => {
        clearInterval(interval);
      };
    },
    beforeExecutionInOrder: (execution) => {
      return () => {
        const log = renderExecutionLog(execution, logOptions);
        writeOutput(log);
      };
    },
  };
};

const renderIntro = (testPlanInfo, logOptions) => {
  const { counters } = testPlanInfo;
  const planified = counters.planified;
  const { groups } = testPlanInfo;
  const groupNames = Object.keys(groups);

  if (planified === 0) {
    return `${renderBigSection({
      title: "nothing to execute",
      content: "",
    })}\n`;
  }
  if (planified === 1) {
    const groupName = groupNames[0];
    const groupInfo = groups[groupName];
    return `${renderBigSection({
      title: "1 execution to run",
      content: `${groupName} (${getGroupRenderedName(groupInfo, logOptions)})`,
    })}\n`;
  }
  if (groupNames.length === 1) {
    const groupName = groupNames[0];
    const groupInfo = groups[groupName];
    return `${renderBigSection({
      title: `${planified} executions to run`,
      content: `${groupName} (${getGroupRenderedName(groupInfo, logOptions)})`,
    })}\n`;
  }

  let introLines = [];
  for (const groupName of groupNames) {
    const groupInfo = groups[groupName];
    introLines.push(
      `${groupInfo.count} with ${groupName} (${getGroupRenderedName(
        groupInfo,
        logOptions,
      )})`,
    );
  }
  return `${renderBigSection({
    title: `${planified} executions to run`,
    content: introLines.join("\n"),
  })}\n`;
};

const getGroupRenderedName = (groupInfo, logOptions) => {
  let { runtimeName, runtimeVersion } = groupInfo;
  if (logOptions.mockFluctuatingValues && groupInfo.runtimeType === "node") {
    runtimeVersion = "<mock>";
  }
  return `${runtimeName}@${runtimeVersion}`;
};

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
const renderExecutionLog = (execution, logOptions) => {
  let log = "\n";
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
  return log;
};

const renderExecutionLabel = (execution, logOptions) => {
  let label = "";

  // description
  {
    const description = renderDescription(execution);
    label += description;
  }
  // runtimeInfo
  {
    const runtimeInfo = renderRuntimeInfo(execution, logOptions);
    if (runtimeInfo) {
      label += ` [${runtimeInfo}]`;
    }
  }
  // intersummary
  if (logOptions.intermediateSummary) {
    let intermediateSummary = "";
    intermediateSummary += ` (${renderStatusRepartition(
      execution.countersInOrder,
    )})`;
    label += ` ${intermediateSummary}`;
  }

  return label;
};
const renderDescription = (execution) => {
  return descriptionFormatters[execution.result.status](execution);
};
const descriptionFormatters = {
  executing: ({ fileRelativeUrl }) => {
    return ANSI.color(`${fileRelativeUrl}`, COLOR_EXECUTING);
  },
  aborted: ({ index, countersInOrder, fileRelativeUrl }) => {
    const total = countersInOrder.planified;
    const number = fillLeft(index + 1, total);

    return ANSI.color(
      `${UNICODE.FAILURE_RAW} ${number}/${total} ${fileRelativeUrl}`,
      COLOR_ABORTED,
    );
  },
  timedout: ({ index, countersInOrder, fileRelativeUrl, params }) => {
    const total = countersInOrder.planified;
    const number = fillLeft(index + 1, total);

    return ANSI.color(
      `${UNICODE.FAILURE_RAW} ${number}/${total} ${fileRelativeUrl} timeout after ${params.allocatedMs}ms`,
      COLOR_TIMEOUT,
    );
  },
  failed: ({ index, countersInOrder, fileRelativeUrl }) => {
    const total = countersInOrder.planified;
    const number = fillLeft(index + 1, total);

    return ANSI.color(
      `${UNICODE.FAILURE_RAW} ${number}/${total} ${fileRelativeUrl}`,
      COLOR_FAILED,
    );
  },
  completed: ({ index, countersInOrder, fileRelativeUrl }) => {
    const total = countersInOrder.planified;
    const number = fillLeft(index + 1, total);

    return ANSI.color(
      `${UNICODE.OK_RAW} ${number}/${total} ${fileRelativeUrl}`,
      COLOR_COMPLETED,
    );
  },
  cancelled: ({ index, countersInOrder, fileRelativeUrl }) => {
    const total = countersInOrder.planified;
    const number = fillLeft(index + 1, total);

    return ANSI.color(
      `${UNICODE.FAILURE_RAW} ${number}/${total} ${fileRelativeUrl}`,
      COLOR_CANCELLED,
    );
  },
};
const renderRuntimeInfo = (execution, logOptions) => {
  const infos = [];
  if (logOptions.group) {
    infos.push(ANSI.color(execution.group, ANSI.GREY));
  }
  const { timings, memoryUsage } = execution.result;
  if (timings) {
    const duration = timings.executionEnd - timings.executionStart;
    const durationFormatted = logOptions.mockFluctuatingValues
      ? `<mock>`
      : msAsDuration(duration, { short: true });
    infos.push(ANSI.color(durationFormatted, ANSI.GREY));
  }
  if (logOptions.memoryUsage && typeof memoryUsage === "number") {
    const memoryUsageFormatted = logOptions.mockFluctuatingValues
      ? `<mock>`
      : byteAsMemoryUsage(memoryUsage);
    infos.push(ANSI.color(memoryUsageFormatted, ANSI.GREY));
  }
  return infos.join(ANSI.color(`/`, ANSI.GREY));
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
      trimLines: true,
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
  debug: UNICODE.DEBUG,
  info: UNICODE.INFO,
  warning: UNICODE.WARNING,
  error: UNICODE.FAILURE,
  log: " ",
};

const renderErrors = (execution, logOptions) => {
  const { errors = [] } = execution.result;
  if (errors.length === 0) {
    return "";
  }

  if (errors.length === 1) {
    return renderSection({
      dashColor: ANSI.RED,
      title: "error",
      content: formatErrorForTerminal(errors[0], {
        rootDirectoryUrl: execution.rootDirectoryUrl,
        mainFileRelativeUrl: execution.fileRelativeUrl,
        mockFluctuatingValues: logOptions.mockFluctuatingValues,
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
        }),
      }),
    );
  });
  return renderSection({
    dashColor: ANSI.RED,
    title: `errors (${errors.length})`,
    content: output.join(`\n`),
  });
};

export const renderOutro = (testPlanInfo, logOptions) => {
  let finalSummary = "";
  const { counters } = testPlanInfo;
  const { planified } = counters;

  if (planified === 1) {
    finalSummary += `1 execution: `;
  } else {
    finalSummary += `${planified} executions: `;
  }
  finalSummary += renderStatusRepartition(counters);

  const { duration } = testPlanInfo;
  const durationFormatted = logOptions.mockFluctuatingValues
    ? "<mock>"
    : msAsDuration(duration);
  finalSummary += `\nduration: ${durationFormatted}`;

  return `\n\n${renderBigSection({ title: "summary", content: finalSummary })}`;
};
const renderStatusRepartition = (counters) => {
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
  if (counters.remaining) {
    parts.push(`${counters.remaining} remaining`);
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
