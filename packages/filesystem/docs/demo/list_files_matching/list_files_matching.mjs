import { listFilesMatching } from "@jsenv/filesystem";

const jsFiles = await listFilesMatching({
  directoryUrl: new URL("./", import.meta.url),
  patterns: {
    "./**/*.js": true,
    "./**/*.test.js": false,
  },
});

console.log(jsFiles);
