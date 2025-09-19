// Mock build function that accepts various parameters
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
