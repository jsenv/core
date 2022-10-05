/*
 * This file exports configuration reused by jsenv scripts such as
 * - scripts/test.mjs
 * - scripts/build.mjs
 */

import { jsenvPluginPreact } from "@jsenv/plugin-preact"

export const rootDirectoryUrl = new URL("./", import.meta.url)

export const plugins = [
  jsenvPluginPreact({
    refresh: {
      "./**/*.jsx": true,
    },
  }),
]
