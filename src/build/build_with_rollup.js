/*
 * we will log something like
 * :check: rollup build done in 1s
 * --- 1 build file ----
 * dist/file.js (10ko)
 * --- build summary ---
 * - build files: 1 (10 ko)
 * - build sourcemap files: none
 * ----------------------
 */

import { rollupPluginJsenv } from "./rollup_plugin_jsenv.js"
import { applyRollupPlugins } from "./apply_rollup_plugins.js"

export const buildWithRollup = async ({
  signal,
  logger,
  projectDirectoryUrl,
  buildDirectoryUrl,
  projectGraph,
  runtimeSupport,
  sourcemapInjection,
}) => {
  const resultRef = { current: null }
  await applyRollupPlugins({
    rollupPlugins: [
      rollupPluginJsenv({
        signal,
        logger,
        projectDirectoryUrl,
        buildDirectoryUrl,
        projectGraph,
        runtimeSupport,
        sourcemapInjection,
        resultRef,
      }),
    ],
    inputOptions: {
      input: [],
      onwarn: (warning) => {
        if (
          warning.code === "EMPTY_BUNDLE" &&
          warning.chunkName === "__empty__"
        ) {
          return
        }
        logger.warn(String(warning))
      },
    },
  })
  return resultRef.current
}
