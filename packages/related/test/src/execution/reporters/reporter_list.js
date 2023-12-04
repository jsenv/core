import stripAnsi from "strip-ansi";
import { createLog, ANSI, UNICODE } from "@jsenv/log";

import { createCallOrderer } from "../../helpers/call_orderer.js";

export const listReporter = ({ logger }) => {
  if (
    logger.levels.debug ||
    logger.levels.info ||
    !process.stdout.isTTY ||
    // if there is an error during execution npm will mess up the output
    // (happens when npm runs several command in a workspace)
    // so we enable hot replace only when !process.exitCode (no error so far)
    process.exitCode === 1
  ) {
    return listReporterBasic();
  }

  return listReportedWithHotReplace();
};

const listReporterBasic = () => {
  return {
    beforeAllExecution: () => {},
    beforeExecution: () => {},
    afterExecution: () => {},
    afterAllExecution: () => {},
  };
};

const listReportedWithHotReplace = () => {
  const dynamicLog = createLog({ newLine: "" });
  const pendingExecutionSet = new Set();
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let frameIndex = 0;
  const interval = setInterval(() => {
    dynamicLog.write(renderLog());
  }, 50);
  const callWhenPreviousExecutionAreDone = createCallOrderer();
  let rawOutput = "";

  const renderLog = () => {
    frameIndex = frameIndex === frames.length - 1 ? 0 : frameIndex + 1;
    const availableLines = process.stdout.rows;
    const pendingExecutions = Array.from(pendingExecutionSet);
    const pendingExecutionsSubset = pendingExecutions.slice(0, availableLines);
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

  return {
    beforeAllExecution: () => {
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
const renderStatusSummary = ({ counters }) => {
  if (counters.aborted === counters.total) {
    return `all ${ANSI.color(`aborted`, ANSI.MAGENTA)}`;
  }
  if (counters.timedout === counters.total) {
    return `all ${ANSI.color(`timed out`, ANSI.MAGENTA)}`;
  }
  if (counters.failed === counters.total) {
    return `all ${ANSI.color(`failed`, ANSI.RED)}`;
  }
  if (counters.completed === counters.total) {
    return `all ${ANSI.color(`completed`, ANSI.GREEN)}`;
  }
  if (counters.cancelled === counters.total) {
    return `all ${ANSI.color(`cancelled`, ANSI.GREY)}`;
  }
  const parts = [];
  if (counters.timedout) {
    parts.push(`${counters.timedout} ${ANSI.color(`timed out`, ANSI.MAGENTA)}`);
  }
  if (counters.failed) {
    parts.push(`${counters.failed} ${ANSI.color(`failed`, ANSI.RED)}`);
  }
  if (counters.completed) {
    parts.push(`${counters.completed} ${ANSI.color(`completed`, ANSI.GREEN)}`);
  }
  if (counters.aborted) {
    parts.push(`${counters.aborted} ${ANSI.color(`aborted`, ANSI.MAGENTA)}`);
  }
  if (counters.cancelled) {
    parts.push(`${counters.cancelled} ${ANSI.color(`cancelled`, ANSI.GREY)}`);
  }
  return `${parts.join(", ")}`;
};

const descriptionFormatters = {
  executing: ({ index, total }) => {
    return ANSI.color(
      `executing ${padNumber(index, total)} of ${total}`,
      ANSI.BLUE,
    );
  },
  aborted: ({ index, total }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${padNumber(
        index,
        total,
      )} of ${total} aborted`,
      ANSI.MAGENTA,
    );
  },
  timedout: ({ index, total, params }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${padNumber(
        index,
        total,
      )} of ${total} timeout after ${params.allocatedMs}ms`,
      ANSI.MAGENTA,
    );
  },
  failed: ({ index, total }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${padNumber(
        index,
        total,
      )} of ${total} failed`,
      ANSI.RED,
    );
  },
  completed: ({ index, total }) => {
    return ANSI.color(
      `${UNICODE.OK_RAW} execution ${padNumber(
        index,
        total,
      )} of ${total} completed`,
      ANSI.GREEN,
    );
  },
  cancelled: ({ index, total }) => {
    return ANSI.color(
      `${UNICODE.FAILURE_RAW} execution ${padNumber(
        index,
        total,
      )} of ${total} cancelled`,
      ANSI.GREY,
    );
  },
};
const padNumber = (index, total) => {
  const number = index + 1;
  const numberWidth = String(number).length;
  const totalWith = String(total).length;
  let missingWidth = totalWith - numberWidth;
  let padded = "";
  while (missingWidth--) {
    padded += "0";
  }
  padded += number;
  return padded;
};
