/*
 * As a first step, and maybe forever we will try to
 * output esmodule and fallback to systemjs
 * The fallback to systemjs will be done later
 * The other formats we'll see afterwards
 */

import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem"
import { createLogger } from "@jsenv/logger"

import { rollupPluginJsenv } from "./rollup_plugin_jsenv.js"
import { applyRollupPlugins } from "./apply_rollup_plugins.js"

export const buildProject = async ({
  logLevel = "info",
  projectDirectoryUrl,
  buildDirectoryUrl,
  entryPoints = {},
  preview = false,
  plugins = [],
  runtimeSupport = {
    android: "0.0.0",
    chrome: "0.0.0",
    edge: "0.0.0",
    electron: "0.0.0",
    firefox: "0.0.0",
    ios: "0.0.0",
    opera: "0.0.0",
    rhino: "0.0.0",
    safari: "0.0.0",
  },
}) => {
  const logger = createLogger({ logLevel })
  projectDirectoryUrl = assertAndNormalizeDirectoryUrl(projectDirectoryUrl)
  assertEntryPoints({ entryPoints })
  buildDirectoryUrl = assertAndNormalizeDirectoryUrl(buildDirectoryUrl)

  const scenario = preview ? "preview" : "prod"
  await applyRollupPlugins({
    rollupPlugins: [
      await rollupPluginJsenv({
        logger,
        projectDirectoryUrl,
        buildDirectoryUrl,
        plugins,
        runtimeSupport,
        scenario,
      }),
    ],
    inputOptions: {
      input: [],
    },
  })
  return null
}

const assertEntryPoints = ({ entryPoints }) => {
  if (typeof entryPoints !== "object" || entryPoints === null) {
    throw new TypeError(`entryPoints must be an object, got ${entryPoints}`)
  }
  const keys = Object.keys(entryPoints)
  keys.forEach((key) => {
    if (!key.startsWith("./")) {
      throw new TypeError(
        `unexpected key in entryPoints, all keys must start with ./ but found ${key}`,
      )
    }
    const value = entryPoints[key]
    if (typeof value !== "string") {
      throw new TypeError(
        `unexpected value in entryPoints, all values must be strings found ${value} for key ${key}`,
      )
    }
    if (value.includes("/")) {
      throw new TypeError(
        `unexpected value in entryPoints, all values must be plain strings (no "/") but found ${value} for key ${key}`,
      )
    }
  })
}
