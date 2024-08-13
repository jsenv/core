import { generateFileSizeReport } from "@jsenv/file-size-impact";

await generateFileSizeReport({
  rootDirectoryUrl: new URL("./", import.meta.url),
  log: true,
  trackingConfig: {
    "first group": {
      "./out/**/*.js": true,
      "./out/**/*.html": false,
      "./out/directory/": false,
    },
    "second group": {
      "./out-2/**/*.js": true,
    },
  },
});
