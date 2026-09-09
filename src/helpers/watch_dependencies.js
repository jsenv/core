/*
 * Detects the moment "npm install" changes what the running pages get from
 * node_modules, so the browser can be reloaded at that moment:
 *
 * - a declared dependency stops being missing or outdated: what package.json
 *   asks for is there;
 * - a package the pages were served changes version: the "?v=" baked into the
 *   urls they evaluated names a version node_modules no longer holds. Left
 *   alone, the next hot reload of a file importing that package resolves it to
 *   the new version and the page evaluates a second copy of the package next
 *   to the first, two module scopes for something meant to exist once.
 *
 * node_modules is deliberately not watched: it is far too big, and an install
 * rewrites, dedupes and moves package directories around, so a watcher placed
 * on one of them is unreliable. Instead a few package.json files are polled,
 * at the cost of a stat each: the packages known to be missing or outdated,
 * and the packages the pages were served, whose package.json the url graph
 * keeps (that is where "?v=" comes from). The project package.json is watched
 * though: it is a single file, and editing it is what puts a dependency out of
 * date in the first place.
 *
 * Both detections run in the same tick so that an install fixing an outdated
 * package the page runs is reported once: two reports would be two reloads,
 * the second one landing on the page that just came back.
 */

import { registerFileLifecycle } from "@jsenv/filesystem";

import {
  packageNameFromSpecifier,
  readDependencyStatuses,
} from "../kitchen/package_dependencies.js";

const POLL_INTERVAL = 500;

export const watchDependencies = (
  packageDirectory,
  {
    getKitchens = () => [],
    onProblem,
    onInstalled,
    onChange,
    pollInterval = POLL_INTERVAL,
  },
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

  const checkServedVersions = (installMap) => {
    for (const kitchen of getKitchens()) {
      for (const urlInfo of kitchen.graph.urlInfoMap.values()) {
        const served = readServedVersion(urlInfo);
        if (!served) {
          continue;
        }
        const installedPackageJson = readInstalledPackageJson(
          packageDirectory,
          served.directoryUrl,
        );
        if (!installedPackageJson) {
          // the package is being rewritten, what it becomes is known once it is back
          continue;
        }
        const installedVersion = installedPackageJson.version;
        if (installedVersion === served.version) {
          continue;
        }
        // the graph learns the file moved, as it would from a watcher: the
        // files importing this package are cooked again with the new "?v="
        // when the page comes back
        urlInfo.onModified();
        if (installMap.has(served.packageName)) {
          continue;
        }
        installMap.set(served.packageName, {
          packageName: served.packageName,
          installedVersion,
          servedVersion: served.version,
          declaredVersion: null,
          severity: "warning",
        });
      }
    }
  };

  const checkDeclared = (installMap) => {
    const statusMap = new Map();
    const nextProblemMap = new Map();
    for (const status of readDependencyStatuses(packageDirectory)) {
      statusMap.set(status.packageName, status);
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
      if (nextProblemMap.has(packageName)) {
        continue;
      }
      const install = installMap.get(packageName);
      if (install) {
        install.declaredVersion = previousStatus.declaredVersion;
        continue;
      }
      installMap.set(packageName, {
        packageName,
        installedVersion: statusMap.get(packageName).installedVersion,
        servedVersion: null,
        declaredVersion: previousStatus.declaredVersion,
        severity: previousStatus.severity,
      });
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
  };

  // The declared dependencies are compared with node_modules only when
  // something can have changed for them: the project package.json was edited,
  // or a problem is known and an install may be fixing it. Comparing them at
  // every tick would catch installs halfway and report a package as missing
  // while it is being rewritten.
  const check = ({ declared }) => {
    const installMap = new Map();
    checkServedVersions(installMap);
    if (declared || problemMap.size > 0) {
      checkDeclared(installMap);
    }
    for (const install of installMap.values()) {
      onInstalled(install);
    }
  };

  const unwatchPackageJson = registerFileLifecycle(
    new URL("package.json", packageDirectory.url),
    {
      added: () => check({ declared: true }),
      updated: () => check({ declared: true }),
      keepProcessAlive: false,
    },
  );
  check({ declared: true });
  const timer = setInterval(() => {
    check({ declared: false });
  }, pollInterval);
  timer.unref();

  watcher.stop = () => {
    clearInterval(timer);
    unwatchPackageJson();
  };
  return watcher;
};

// The url graph keeps the content of every package.json it resolved a bare
// specifier against, and that content holds the version the page received.
// It is parsed once per content: the same string is seen at every tick.
const servedVersionCache = new WeakMap();
const readServedVersion = (urlInfo) => {
  const { url, content } = urlInfo;
  if (content === undefined) {
    return null;
  }
  if (!url.startsWith("file:") || !url.endsWith("/package.json")) {
    return null;
  }
  const nodeModulesIndex = url.lastIndexOf("/node_modules/");
  if (nodeModulesIndex === -1) {
    return null;
  }
  // dereferenced url infos stay in the graph; nothing imports this package anymore
  if (urlInfo.referenceFromOthersSet.size === 0) {
    return null;
  }
  const fromCache = servedVersionCache.get(urlInfo);
  if (fromCache && fromCache.content === content) {
    return fromCache;
  }
  let packageJson;
  try {
    packageJson = JSON.parse(content);
  } catch {
    return null;
  }
  const served = {
    content,
    directoryUrl: new URL("./", url).href,
    packageName: packageNameFromSpecifier(
      url.slice(nodeModulesIndex + "/node_modules/".length),
    ),
    version: packageJson.version,
  };
  servedVersionCache.set(urlInfo, served);
  return served;
};

// an install in progress can be caught halfway, with a package.json not written yet
const readInstalledPackageJson = (packageDirectory, directoryUrl) => {
  try {
    return packageDirectory.read(directoryUrl);
  } catch {
    return null;
  }
};
