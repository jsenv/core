import stripAnsi from "strip-ansi";
import { createLog, ANSI, UNICODE } from "@jsenv/log";

import { createCallOrderer } from "../../helpers/call_orderer.js";

export const listReporter = ({ logger }) => {
  const canEraseProcessStdout =
    process.stdout.isTTY &&
    !logger.levels.debug &&
    !logger.levels.info &&
    // if there is an error during execution npm will mess up the output
    // (happens when npm runs several command in a workspace)
    // so we enable hot replace only when !process.exitCode (no error so far)
    process.exitCode !== 1;
  const callWhenPreviousExecutionAreDone = createCallOrderer();

  return {
    beforeAllExecution: (testPlanInfo) => {
      logger.info(`${testPlanInfo.executions.size} executions planified`);

      if (!canEraseProcessStdout) {
        return null;
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
    beforeExecution: (executionInfo) => {
      pendingExecutionSet.add(executionInfo);
      return () => {
        callWhenPreviousExecutionAreDone(executionInfo.executionIndex, () => {
          pendingExecutionSet.delete(executionInfo);
          // erase the dynamic part
          dynamicLog.write("");
          // log that execution
          const log = renderExecutionLog(executionInfo);
          console.log(log);
          // TODO: write the raw output into a file
          rawOutput += stripAnsi(log);
        });
      };
    },
  };
};

const renderExecutionLog = () => {};

const renderExecutionLabel = ({
  index,
  params,
  result,
  duration,
  memoryHeap,
  counters,
}) => {
  const { status } = result;
  const descriptionFormatter = descriptionFormatters[status];
  const description = descriptionFormatter({
    index,
    total: counters.total,
    params,
  });
  const intermediateSummaryText = renderIntermediateSummary({
    index,
    counters,
    duration,
    memoryHeap,
  });
  return `${description}${intermediateSummaryText}`;
};
const renderIntermediateSummary = ({
  index,
  counters,
  memoryHeap,
  timeEllapsed,
  logTimeUsage,
}) => {
  const parts = [];
  if (index > 0 || counters.done > 0) {
    parts.push(
      renderStatusSummary({
        counters: {
          ...counters,
          total: index + 1,
        },
      }),
    );
  }
  if (logTimeUsage && timeEllapsed) {
    parts.push(`${msAsEllapsedTime(timeEllapsed)}`);
  }
  if (logMemoryHeapUsage && memoryHeap) {
    parts.push(`${byteAsMemoryUsage(memoryHeap)}`);
  }
  if (parts.length === 0) {
    return "";
  }
  return ` (${parts.join(` / `)})`;
};
const COLOR_EXECUTING = ANSI.BLUE;
const COLOR_ABORTED = ANSI.MAGENTA;
const COLOR_TIMEOUT = ANSI.MAGENTA;
const COLOR_FAILED = ANSI.RED;
const COLOR_COMPLETED = ANSI.GREEN;
const COLOR_CANCELLED = ANSI.GREY;
const renderStatusSummary = ({ counters }) => {
  if (counters.aborted === counters.total) {
    return `all ${ANSI.color(`aborted`, COLOR_ABORTED)}`;
  }
  if (counters.timedout === counters.total) {
    return `all ${ANSI.color(`timed out`, COLOR_TIMEOUT)}`;
  }
  if (counters.failed === counters.total) {
    return `all ${ANSI.color(`failed`, COLOR_FAILED)}`;
  }
  if (counters.completed === counters.total) {
    return `all ${ANSI.color(`completed`, COLOR_COMPLETED)}`;
  }
  if (counters.cancelled === counters.total) {
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
const descriptionFormatters = {
  executing: ({ index, total }) => {
    return ANSI.color(
      `executing ${padNumber(index, total)} of ${total}`,
      COLOR_EXECUTING,
    );
  },
  aborted: ({ index, total }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${padNumber(
        index,
        total,
      )} of ${total} aborted`,
      COLOR_ABORTED,
    );
  },
  timedout: ({ index, total, params }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${padNumber(
        index,
        total,
      )} of ${total} timeout after ${params.allocatedMs}ms`,
      COLOR_TIMEOUT,
    );
  },
  failed: ({ index, total }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${padNumber(
        index,
        total,
      )} of ${total} failed`,
      COLOR_FAILED,
    );
  },
  completed: ({ index, total }) => {
    return ANSI.color(
      `${UNICODE.OK_RAW} execution ${padNumber(
        index,
        total,
      )} of ${total} completed`,
      COLOR_COMPLETED,
    );
  },
  cancelled: ({ index, total }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${padNumber(
        index,
        total,
      )} of ${total} cancelled`,
      COLOR_CANCELLED,
    );
  },
};
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
