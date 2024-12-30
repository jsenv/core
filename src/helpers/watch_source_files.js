import { registerDirectoryLifecycle } from "@jsenv/filesystem";
import { urlToRelativeUrl } from "@jsenv/urls";
import { readFileSync } from "node:fs";
import { lookupPackageDirectory } from "./lookup_package_directory.js";

export const watchSourceFiles = (
  sourceDirectoryUrl,
  callback,
  { sourceFileConfig = {}, keepProcessAlive, cooldownBetweenFileEvents },
) => {
  // Project should use a dedicated directory (usually "src/")
  // passed to the dev server via "sourceDirectoryUrl" param
  // In that case all files inside the source directory should be watched
  // But some project might want to use their root directory as source directory
  // In that case source directory might contain files matching "node_modules/*" or ".git/*"
  // And jsenv should not consider these as source files and watch them (to not hurt performances)
  const watchPatterns = {};
  const addDirectoryToWatch = (directoryUrlRelativeToRoot) => {
    Object.assign(watchPatterns, {
      [`${directoryUrlRelativeToRoot}**/*`]: true, // by default watch everything inside the source directory
      // line below is commented until @jsenv/url-meta fixes the fact that is matches
      // any file with an extension
      [`${directoryUrlRelativeToRoot}**/.*`]: false, // file starting with a dot -> do not watch
      [`${directoryUrlRelativeToRoot}**/.*/`]: false, // directory starting with a dot -> do not watch
      [`${directoryUrlRelativeToRoot}**/node_modules/`]: false, // node_modules directory -> do not watch
    });
    for (const key of Object.keys(sourceFileConfig)) {
      watchPatterns[`${directoryUrlRelativeToRoot}${key}`] =
        sourceFileConfig[key];
    }
  };
  const watch = (rootDirectoryUrl) => {
    const stopWatchingSourceFiles = registerDirectoryLifecycle(
      rootDirectoryUrl,
      {
        watchPatterns,
        cooldownBetweenFileEvents,
        keepProcessAlive,
        recursive: true,
        added: ({ relativeUrl }) => {
          callback({
            url: new URL(relativeUrl, rootDirectoryUrl).href,
            event: "added",
          });
        },
        updated: ({ relativeUrl }) => {
          callback({
            url: new URL(relativeUrl, rootDirectoryUrl).href,
            event: "modified",
          });
        },
        removed: ({ relativeUrl }) => {
          callback({
            url: new URL(relativeUrl, rootDirectoryUrl).href,
            event: "removed",
          });
        },
      },
    );
    stopWatchingSourceFiles.watchPatterns = watchPatterns;
    return stopWatchingSourceFiles;
  };

  npm_workspaces: {
    const packageDirectoryUrl = lookupPackageDirectory(sourceDirectoryUrl);
    let packageContent;
    try {
      packageContent = JSON.parse(
        readFileSync(new URL("package.json", packageDirectoryUrl), "utf8"),
      );
    } catch {
      break npm_workspaces;
    }
    const { workspaces } = packageContent;
    if (!workspaces || !Array.isArray(workspaces) || workspaces.length === 0) {
      break npm_workspaces;
    }
    for (const workspace of workspaces) {
      if (workspace.endsWith("*")) {
        const workspaceRelativeUrl = urlToRelativeUrl(
          new URL(workspace.slice(0, -1), packageDirectoryUrl),
          packageDirectoryUrl,
        );
        addDirectoryToWatch(workspaceRelativeUrl);
      } else {
        const workspaceRelativeUrl = urlToRelativeUrl(
          new URL(workspace, packageDirectoryUrl),
          packageDirectoryUrl,
        );
        addDirectoryToWatch(workspaceRelativeUrl);
      }
    }
    // we are updating the root directory
    // we must make the patterns relative to source directory relative to the new root directory
    const sourceRelativeToPackage = urlToRelativeUrl(
      sourceDirectoryUrl,
      packageDirectoryUrl,
    );
    addDirectoryToWatch(sourceRelativeToPackage);
    return watch(packageDirectoryUrl);
  }

  addDirectoryToWatch("");
  return watch(sourceDirectoryUrl);
};
