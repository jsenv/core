import stripAnsi from "strip-ansi";
import wrapAnsi from "wrap-ansi";
import { writeFileSync } from "@jsenv/filesystem";
import {
  createLog,
  ANSI,
  UNICODE,
  msAsDuration,
  byteAsMemoryUsage,
} from "@jsenv/log";

import { createCallOrderer } from "../../helpers/call_orderer.js";

export const listReporter = ({
  logger,
  logDynamic,
  logMemoryUsage,
  logFileUrl,
}) => {
  const canEraseProcessStdout =
    logDynamic &&
    process.stdout.isTTY &&
    !logger.levels.debug &&
    !logger.levels.info &&
    // if there is an error during execution npm will mess up the output
    // (happens when npm runs several command in a workspace)
    // so we enable hot replace only when !process.exitCode (no error so far)
    process.exitCode !== 1;
  const callWhenPreviousExecutionAreDone = createCallOrderer();

  let rawOutput = "";
  const writeOutput = (log) => {
    if (logger.levels.info) {
      process.stdout.write(log);
    }
    rawOutput += stripAnsi(log);
    writeFileSync(logFileUrl, rawOutput);
  };

  const addIntermediateSummary = !canEraseProcessStdout;

  return {
    beforeAllExecution: (testPlanReport) => {
      writeOutput(
        `${testPlanReport.counters.planified} executions planified\n`,
      );
      if (!canEraseProcessStdout) {
        return () => {
          writeOutput(renderFinalSummary(testPlanReport));
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
              `executing ${padNumber(
                pendingExecution.index,
                pendingExecution.total,
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
    beforeExecution: (execution) => {
      return () => {
        const countersWhenExecutionEnded = { ...execution.counters };
        callWhenPreviousExecutionAreDone(execution.index, () => {
          execution.counters = countersWhenExecutionEnded;
          const log = renderExecutionLog(execution, {
            logMemoryUsage,
            addIntermediateSummary,
          });
          writeOutput(log);
        });
      };
    },
  };
};

/*
 *                         label
 *       ┌───────────────────┴───────────────────────────────┐
 *       │                               │                   │
 *  description                       metrics                │
 *  ┌────┴─────┐                      ┌──┴───┐               │
 *  │          │                      │      │               │
 * icon      file          runtime duration memory  intermediate summary
 * ┌┴┐┌────────┴─────────┐ ┌──┴──┐ ┌──┴──┐┌──┴──┐ ┌──────────┴──────────┐
 *  ✔ tests/file.test.html on node [10.4s/14.5MB] (2 completed, 1 failed)
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
const renderExecutionLog = (
  execution,
  { logMemoryUsage, addIntermediateSummary },
) => {
  let log = "\n";
  // label
  {
    const label = renderExecutionLabel(execution, {
      logMemoryUsage,
      addIntermediateSummary,
    });
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
    const { errors = [] } = execution.result;
    const errorOutput = renderErrors(errors);
    if (errorOutput) {
      log += `\n${errorOutput}`;
    }
  }
  const { columns = 80 } = process.stdout;
  log = wrapAnsi(log, columns, {
    trim: false,
    hard: true,
    wordWrap: false,
  });
  return log;
};

const renderExecutionLabel = (
  execution,
  { logMemoryUsage, addIntermediateSummary },
) => {
  let label = "";

  // description
  {
    const description = renderDescription(execution);
    label += description;
  }
  // metrics
  {
    const metrics = renderMetrics(execution, { logMemoryUsage });
    if (metrics) {
      label += ` [${metrics}]`;
    }
  }
  // intersummary
  if (addIntermediateSummary) {
    const intermediateSummary = renderStatusRepartition(execution.counters);
    if (intermediateSummary) {
      label += ` (${intermediateSummary})`;
    }
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
  aborted: ({ fileRelativeUrl }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} ${fileRelativeUrl}`,
      COLOR_ABORTED,
    );
  },
  timedout: ({ fileRelativeUrl, params }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} ${fileRelativeUrl} timeout after ${params.allocatedMs}ms`,
      COLOR_TIMEOUT,
    );
  },
  failed: ({ fileRelativeUrl }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} ${fileRelativeUrl}`,
      COLOR_FAILED,
    );
  },
  completed: ({ fileRelativeUrl }) => {
    return ANSI.color(`${UNICODE.OK_RAW} ${fileRelativeUrl}`, COLOR_COMPLETED);
  },
  cancelled: ({ fileRelativeUrl }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} ${fileRelativeUrl}`,
      COLOR_CANCELLED,
    );
  },
};
const renderMetrics = (execution, { logMemoryUsage }) => {
  const metrics = [];
  const { timings, memoryUsage } = execution.result;
  if (timings) {
    const duration = timings.executionEnd - timings.executionStart;
    metrics.push(
      ANSI.color(`${msAsDuration(duration, { short: true })}`, ANSI.GREY),
    );
  }
  if (logMemoryUsage && typeof memoryUsage === "number") {
    metrics.push(ANSI.color(`${byteAsMemoryUsage(memoryUsage)}`, ANSI.GREY));
  }
  return metrics.join(`/`);
};
const COLOR_EXECUTING = ANSI.BLUE;
const COLOR_ABORTED = ANSI.MAGENTA;
const COLOR_TIMEOUT = ANSI.MAGENTA;
const COLOR_FAILED = ANSI.RED;
const COLOR_COMPLETED = ANSI.GREEN;
const COLOR_CANCELLED = ANSI.GREY;
const padNumber = (index, total, char = "0") => {
  const number = index + 1;
  const numberWidth = String(number).length;
  const totalWith = String(total).length;
  let missingWidth = totalWith - numberWidth;
  let padded = "";
  while (missingWidth--) {
    padded += char;
  }
  padded += number;
  return padded;
};

const renderConsole = (consoleCalls) => {
  if (consoleCalls.length === 0) {
    return "";
  }
  const repartition = {
    debug: 0,
    info: 0,
    warning: 0,
    error: 0,
    log: 0,
  };
  consoleCalls.forEach((consoleCall) => {
    repartition[consoleCall.type]++;
  });
  const consoleOutput = renderConsoleOutput(consoleCalls);
  const consoleHeader = `-------- ${renderConsoleSummary(
    repartition,
  )} --------`;
  const consoleFooter = `-`.repeat(stripAnsi(consoleHeader).length);

  return `${ANSI.color(consoleHeader, ANSI.GREY)}
${consoleOutput}
${ANSI.color(consoleFooter, ANSI.GREY)}`;
};
const renderConsoleSummary = (repartition) => {
  const { debug, info, warning, error } = repartition;
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

const renderErrors = (errors) => {
  if (errors.length === 0) {
    return "";
  }

  if (errors.length === 1) {
    return `${ANSI.color(`-------- error --------`, ANSI.RED)}
${renderError(errors[0])}
${ANSI.color(`-------------------------`, ANSI.RED)}`;
  }

  let output = [];
  errors.forEach((error) => {
    output.push(
      prefixFirstAndIndentRemainingLines({
        prefix: `${UNICODE.CIRCLE_CROSS} `,
        indentation: "   ",
        text: renderError(error),
      }),
    );
  });
  return `${ANSI.color(`-------- errors (${errors.length}) --------`, ANSI.RED)}
${output.join(`\n`)}
${ANSI.color(`-------------------------`, ANSI.RED)}`;
};
const renderError = (error) => {
  if (error === null || error === undefined) {
    return String(error);
  }
  if (error) {
    return error.stack || error.message || error;
  }
  return error;
};

export const renderFinalSummary = (testPlanReport) => {
  let finalSummary = "";
  const counters = testPlanReport.counters;
  const duration = testPlanReport.duration;

  if (counters.done === 1) {
    finalSummary += `1 execution: `;
  } else {
    finalSummary += `${counters.done} executions `;
  }
  finalSummary += renderStatusRepartition(counters);
  finalSummary += `\nduration: ${msAsDuration(duration)}`;

  return `\n\n-------------- summary -----------------
${finalSummary}
----------------------------------------`;
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
  return `${parts.join(", ")}`;
};
