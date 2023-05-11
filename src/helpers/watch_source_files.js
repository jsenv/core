import { registerDirectoryLifecycle } from "@jsenv/filesystem";

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
  const watchPatterns = {
    "**/*": true, // by default watch everything inside the source directory
    // line below is commented until @jsenv/url-meta fixes the fact that is matches
    // any file with an extension
    "**/.*": false, // file starting with a dot -> do not watch
    "**/.*/": false, // directory starting with a dot -> do not watch
    "**/node_modules/": false, // node_modules directory -> do not watch
    ...sourceFileConfig,
  };
  const stopWatchingSourceFiles = registerDirectoryLifecycle(
    sourceDirectoryUrl,
    {
      watchPatterns,
      cooldownBetweenFileEvents,
      keepProcessAlive,
      recursive: true,
      added: ({ relativeUrl }) => {
        callback({
          url: new URL(relativeUrl, sourceDirectoryUrl).href,
          event: "added",
        });
      },
      updated: ({ relativeUrl }) => {
        callback({
          url: new URL(relativeUrl, sourceDirectoryUrl).href,
          event: "modified",
        });
      },
      removed: ({ relativeUrl }) => {
        callback({
          url: new URL(relativeUrl, sourceDirectoryUrl).href,
          event: "removed",
        });
      },
    },
  );
  stopWatchingSourceFiles.watchPatterns = watchPatterns;
  return stopWatchingSourceFiles;
};
