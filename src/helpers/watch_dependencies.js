/*
 * Detects when "npm install" makes a missing or outdated dependency match what
 * the project package.json declares, so the browser can be reloaded at that
 * moment.
 *
 * node_modules is deliberately not watched: it is far too big, and an install
 * rewrites, dedupes and moves package directories around, so a watcher placed
 * on one of them is unreliable. Instead the few packages known to be missing or
 * outdated are polled, which costs a couple of readFileSync and stops as soon as
 * they are all installed. The project package.json is watched though: it is a
 * single file, and editing it is what puts a dependency out of date in the first
 * place.
 */

import { registerFileLifecycle } from "@jsenv/filesystem";

import { readDependencyStatuses } from "../kitchen/package_dependencies.js";

const POLL_INTERVAL = 500;

export const watchDependencies = (
  packageDirectory,
  { onProblem, onInstalled, onChange, pollInterval = POLL_INTERVAL },
) => {
  let problemMap = new Map();
  // every path given to the browser is relative to the package directory, the
  // one holding the package.json being watched
  const packageJsonPath = "package.json";
  const watcher = {
    getProblems: () => Array.from(problemMap.values()),
    // what the browser needs to display the watching in progress
    getWatchInfo: () => ({ packageJsonPath, pollInterval }),
    stop: () => {},
  };
  if (!packageDirectory.url) {
    return watcher;
  }
  let timer = null;

  const check = () => {
    const nextProblemMap = new Map();
    for (const status of readDependencyStatuses(packageDirectory)) {
      if (status.state === "missing" || status.state === "outdated") {
        nextProblemMap.set(status.packageName, status);
      }
    }
    for (const [packageName, status] of nextProblemMap) {
      const previousStatus = problemMap.get(packageName);
      if (
        !previousStatus ||
        previousStatus.state !== status.state ||
        previousStatus.declaredVersion !== status.declaredVersion
      ) {
        onProblem(status);
      }
    }
    for (const [packageName, previousStatus] of problemMap) {
      if (!nextProblemMap.has(packageName)) {
        onInstalled(previousStatus);
      }
    }
    const changed =
      nextProblemMap.size !== problemMap.size ||
      Array.from(nextProblemMap.keys()).some((packageName) => {
        const previousStatus = problemMap.get(packageName);
        const status = nextProblemMap.get(packageName);
        return (
          !previousStatus ||
          previousStatus.state !== status.state ||
          previousStatus.declaredVersion !== status.declaredVersion ||
          previousStatus.installedVersion !== status.installedVersion
        );
      });
    problemMap = nextProblemMap;
    if (changed) {
      onChange(watcher.getProblems());
    }
    if (problemMap.size === 0) {
      stopPolling();
    } else {
      startPolling();
    }
  };

  const startPolling = () => {
    if (timer) {
      return;
    }
    timer = setInterval(check, pollInterval);
    timer.unref();
  };
  const stopPolling = () => {
    if (!timer) {
      return;
    }
    clearInterval(timer);
    timer = null;
  };

  const unwatchPackageJson = registerFileLifecycle(
    new URL("package.json", packageDirectory.url),
    {
      added: check,
      updated: check,
      keepProcessAlive: false,
    },
  );
  check();

  watcher.stop = () => {
    stopPolling();
    unwatchPackageJson();
  };
  return watcher;
};
