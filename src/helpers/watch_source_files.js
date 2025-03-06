import { registerDirectoryLifecycle } from "@jsenv/filesystem";
import { urlToRelativeUrl } from "@jsenv/urls";
import { readFileSync } from "node:fs";
import { lookupPackageDirectory } from "./lookup_package_directory.js";

export const getDirectoryWatchPatterns = (
  directoryUrl,
  watchedDirectoryUrl,
  { sourceFilesConfig },
) => {
  const directoryUrlRelativeToWatchedDirectory = urlToRelativeUrl(
    directoryUrl,
    watchedDirectoryUrl,
  );
  const watchPatterns = {
    [`${directoryUrlRelativeToWatchedDirectory}**/*`]: true, // by default watch everything inside the source directory
    [`${directoryUrlRelativeToWatchedDirectory}**/.*`]: false, // file starting with a dot -> do not watch
    [`${directoryUrlRelativeToWatchedDirectory}**/.*/`]: false, // directory starting with a dot -> do not watch
    [`${directoryUrlRelativeToWatchedDirectory}**/node_modules/`]: false, // node_modules directory -> do not watch
  };
  for (const key of Object.keys(sourceFilesConfig)) {
    watchPatterns[`${directoryUrlRelativeToWatchedDirectory}${key}`] =
      sourceFilesConfig[key];
  }
  return watchPatterns;
};

export const watchSourceFiles = (
  sourceDirectoryUrl,
  callback,
  { sourceFilesConfig = {}, keepProcessAlive, cooldownBetweenFileEvents },
) => {
  // Project should use a dedicated directory (usually "src/")
  // passed to the dev server via "sourceDirectoryUrl" param
  // In that case all files inside the source directory should be watched
  // But some project might want to use their root directory as source directory
  // In that case source directory might contain files matching "node_modules/*" or ".git/*"
  // And jsenv should not consider these as source files and watch them (to not hurt performances)
  const watchPatterns = {};
  let watchedDirectoryUrl = "";
  const addDirectoryToWatch = (directoryUrl) => {
    Object.assign(
      watchPatterns,
      getDirectoryWatchPatterns(directoryUrl, watchedDirectoryUrl, {
        sourceFilesConfig,
      }),
    );
  };
  const watch = () => {
    const stopWatchingSourceFiles = registerDirectoryLifecycle(
      watchedDirectoryUrl,
      {
        watchPatterns,
        cooldownBetweenFileEvents,
        keepProcessAlive,
        recursive: true,
        added: ({ relativeUrl }) => {
          callback({
            url: new URL(relativeUrl, watchedDirectoryUrl).href,
            event: "added",
          });
        },
        updated: ({ relativeUrl }) => {
          callback({
            url: new URL(relativeUrl, watchedDirectoryUrl).href,
            event: "modified",
          });
        },
        removed: ({ relativeUrl }) => {
          callback({
            url: new URL(relativeUrl, watchedDirectoryUrl).href,
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
    watchedDirectoryUrl = packageDirectoryUrl;
    for (const workspace of workspaces) {
      if (workspace.endsWith("*")) {
        const workspaceDirectoryUrl = new URL(
          workspace.slice(0, -1),
          packageDirectoryUrl,
        );
        addDirectoryToWatch(workspaceDirectoryUrl);
      } else {
        const workspaceRelativeUrl = new URL(workspace, packageDirectoryUrl);
        addDirectoryToWatch(workspaceRelativeUrl);
      }
    }
    // we are updating the root directory
    // we must make the patterns relative to source directory relative to the new root directory
    addDirectoryToWatch(sourceDirectoryUrl);
    return watch();
  }

  watchedDirectoryUrl = sourceDirectoryUrl;
  addDirectoryToWatch(sourceDirectoryUrl);
  return watch();
};
