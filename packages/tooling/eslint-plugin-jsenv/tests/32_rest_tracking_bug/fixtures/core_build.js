// core_build.js - the actual build function that accepts many parameters
export const build = async ({
  logLevel,
  rootDirectoryUrl,
  buildDirectoryUrl,
  entryPoints,
  outDirectoryUrl,
  versioning,
  minification,
  bundling,
  // ... and potentially many other parameters
}) => {
  return {
    buildFileContents: {
      "main.js": "console.log('built');",
    },
  };
};
