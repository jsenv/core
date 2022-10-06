/*
 * This file exports configuration reused by jsenv scripts such as
 *
 * scripts/test.mjs
 * scripts/build.mjs
 *
 * Read more at https://github.com/jsenv/jsenv-core#jsenvconfigmjs
 */

import { jsenvPluginReact } from "@jsenv/plugin-react"

export const rootDirectoryUrl = new URL("./", import.meta.url)

export const plugins = [
  jsenvPluginReact({
    refreshInstrumentation: {
      "./**/*.jsx": true,
    },
  }),
]
