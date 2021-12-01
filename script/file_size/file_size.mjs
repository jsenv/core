/*
 * This file is designed to be executed locally or by an automated process.
 *
 * To run it locally, use one ofs
 * - node ./script/file_size/file_size.mjs --local
 * - npm run file-size
 *
 * The automated process is a GitHub workflow: ".github/workflows/file_size_impact.yml"
 * It will dynamically import this file and call generateFileSizeReport.
 *
 * See https://github.com/jsenv/file-size-impact
 */

import { generateFileSizeReport, raw, gzip } from "@jsenv/file-size-impact"

import { projectDirectoryUrl } from "../../jsenv.config.mjs"

const dist = {
  "./dist/**/*.html": true,
  "./dist/**/*.js": true,
  "./dist/**/*.svg": true,
  "./dist/**/*.png": true,
  "./dist/**/*.jpg": true,
  "./dist/**/*.css": true,
  "./dist/build_manifest.js": false,
}

export const fileSizeReport = await generateFileSizeReport({
  log: process.argv.includes("--log"),
  projectDirectoryUrl,
  transformations: { raw, gzip },
  trackingConfig: { dist },
  manifestConfig: {
    "./dist/**/asset-manifest.json": true,
  },
})
