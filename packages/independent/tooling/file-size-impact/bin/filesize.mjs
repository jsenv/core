#!/usr/bin/env node

import { generateFileSizeReport } from "@jsenv/file-size-impact";
import { pathToFileURL } from "node:url";

const cwdUrl = `${pathToFileURL(process.cwd())}/`;
const argv = process.argv.slice(2);
const dirname = argv[0] || "dist";

await generateFileSizeReport({
  log: true,
  rootDirectoryUrl: cwdUrl,
  trackingConfig: {
    [dirname]: {
      [`${dirname}/**/*`]: true,
      [`${dirname}/**/*.map`]: false,
    },
  },
});
