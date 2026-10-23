/*
 * Remembers, from one run to the next, how long each execution took and how much
 * time it asked for (see requestAllocatedMs).
 *
 * What it is for: with a fixed number of parallel slots, an execution still
 * running when everything after it is done decides alone when the run ends.
 * Started last it keeps one slot busy while every other one is idle. Knowing
 * the durations of the previous run is what allows to recognize that execution
 * and start it ahead of its turn (see "parallel.maxAhead").
 *
 * Only the start order is affected: executions keep the index they got from the
 * filesystem, so they are still reported in that order.
 *
 * The duration of the whole run is remembered too, so the logs can tell how
 * long the wait will likely be. It is kept per run name (what the run was
 * narrowed to): the duration of every test in the repository says nothing about
 * the duration of the tests of one package.
 */

import { writeFileSync } from "@jsenv/filesystem";
import { readFileSync } from "node:fs";

const MS_IN_A_DAY = 24 * 60 * 60 * 1000;
// an execution not seen for that long is likely a file that no longer exists
const ENTRY_MAX_AGE_MS = 30 * MS_IN_A_DAY;

export const createExecutionTimings = ({ fileUrl }) => {
  const { previousEntryMap, previousRunEntryMap } = readMemory(fileUrl);
  const entryMap = new Map();
  const runEntryMap = new Map();

  return {
    getRunDurationMs: (runName) => {
      const previousRunEntry = previousRunEntryMap.get(runName);
      if (!previousRunEntry) {
        return null;
      }
      return previousRunEntry.durationMs;
    },
    recordRun: (runName, durationMs) => {
      runEntryMap.set(runName, {
        durationMs,
        updatedAt: Date.now(),
      });
    },
    getAllocatedMsRequested: (executionName) => {
      const previousEntry = previousEntryMap.get(executionName);
      if (!previousEntry) {
        return undefined;
      }
      return previousEntry.allocatedMsRequested;
    },
    // how long each execution is expected to take on this run
    estimateDurations: (executionArray) => {
      const durationMsMap = new Map();
      const durationMsArray = [];
      for (const execution of executionArray) {
        if (execution.skipped) {
          // a skipped execution costs nothing; it must not weigh on what is
          // expected from the others
          durationMsMap.set(execution, 0);
          continue;
        }
        const previousEntry = previousEntryMap.get(execution.name);
        if (previousEntry) {
          durationMsMap.set(execution, previousEntry.durationMs);
          durationMsArray.push(previousEntry.durationMs);
        }
      }
      // an execution never seen before is assumed to last as long as the median:
      // being new is not a reason to be considered short
      durationMsArray.sort((a, b) => a - b);
      const medianDurationMs =
        durationMsArray.length === 0
          ? 0
          : durationMsArray[Math.floor(durationMsArray.length / 2)];
      for (const execution of executionArray) {
        if (!durationMsMap.has(execution)) {
          durationMsMap.set(execution, medianDurationMs);
        }
      }
      return durationMsMap;
    },
    record: (execution) => {
      const { status, timings } = execution.result;
      if (
        status !== "completed" &&
        status !== "failed" &&
        status !== "timedout"
      ) {
        // an execution that was skipped, aborted or cancelled says nothing
        // about how long the file needs
        return;
      }
      const entry = {
        durationMs: timings.end,
        updatedAt: Date.now(),
      };
      if (execution.allocatedMsRequested !== undefined) {
        entry.allocatedMsRequested = execution.allocatedMsRequested;
      }
      entryMap.set(execution.name, entry);
    },
    write: () => {
      const nowMs = Date.now();
      writeFileSync(
        fileUrl,
        JSON.stringify(
          {
            // what is not part of this run keeps what was known about it
            executions: mergeEntries(previousEntryMap, entryMap, nowMs),
            runs: mergeEntries(previousRunEntryMap, runEntryMap, nowMs),
          },
          null,
          "  ",
        ),
      );
    },
  };
};

const mergeEntries = (previousEntryMap, entryMap, nowMs) => {
  const entries = {};
  for (const [name, entry] of previousEntryMap) {
    if (nowMs - entry.updatedAt < ENTRY_MAX_AGE_MS) {
      entries[name] = entry;
    }
  }
  for (const [name, entry] of entryMap) {
    entries[name] = entry;
  }
  return entries;
};

const readMemory = (fileUrl) => {
  const previousEntryMap = new Map();
  const previousRunEntryMap = new Map();
  const memory = { previousEntryMap, previousRunEntryMap };
  let fileContent;
  try {
    fileContent = readFileSync(new URL(fileUrl), "utf8");
  } catch {
    // no memory of a previous run: every execution is an unknown
    return memory;
  }
  let executions;
  let runs;
  try {
    ({ executions, runs } = JSON.parse(fileContent));
  } catch {
    // file was truncated by a run killed while writing it
    return memory;
  }
  fillEntryMap(previousEntryMap, executions);
  fillEntryMap(previousRunEntryMap, runs);
  return memory;
};

const fillEntryMap = (entryMap, entries) => {
  if (!entries) {
    return;
  }
  for (const name of Object.keys(entries)) {
    const entry = entries[name];
    if (typeof entry.durationMs === "number") {
      entryMap.set(name, entry);
    }
  }
};
