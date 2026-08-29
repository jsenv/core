import {
  lookupPackageDirectory,
  registerDirectoryLifecycle,
} from "@jsenv/filesystem";
import { urlIsOrIsInsideOf, urlToRelativeUrl } from "@jsenv/urls";
import { readFileSync } from "node:fs";

export const getDirectoryWatchPatterns = (
  directoryUrl,
  watchedDirectoryUrl,
  { sourceFilesConfig, defaultPatterns = true },
) => {
  const directoryUrlRelativeToWatchedDirectory = urlToRelativeUrl(
    directoryUrl,
    watchedDirectoryUrl,
  );
  const watchPatterns = {};
  if (defaultPatterns) {
    Object.assign(watchPatterns, {
      [`${directoryUrlRelativeToWatchedDirectory}**/*`]: true, // by default watch everything inside the source directory
      [`${directoryUrlRelativeToWatchedDirectory}**/.*`]: false, // file starting with a dot -> do not watch
      [`${directoryUrlRelativeToWatchedDirectory}**/.*/`]: false, // directory starting with a dot -> do not watch
      [`${directoryUrlRelativeToWatchedDirectory}**/node_modules/`]: false, // node_modules directory -> do not watch
    });
  }
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
  const addDirectoryToWatch = (directoryUrl, { defaultPatterns } = {}) => {
    Object.assign(
      watchPatterns,
      getDirectoryWatchPatterns(directoryUrl, watchedDirectoryUrl, {
        sourceFilesConfig,
        defaultPatterns,
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
      const workspaceDirectoryUrl = workspace.endsWith("*")
        ? new URL(workspace.slice(0, -1), packageDirectoryUrl)
        : new URL(workspace, packageDirectoryUrl);
      addDirectoryToWatch(workspaceDirectoryUrl, {
        // The source directory patterns already cover a workspace inside it.
        // Every pattern is tested against every file found while watching, so
        // the same patterns rooted at each workspace only multiply that work.
        defaultPatterns: !urlIsOrIsInsideOf(
          workspaceDirectoryUrl,
          sourceDirectoryUrl,
        ),
      });
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
