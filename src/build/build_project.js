/*
 * As a first step, and maybe forever we will try to
 * output esmodule and fallback to systemjs
 * The fallback to systemjs will be done later
 * The other formats we'll see afterwards
 */

import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem"
import { createLogger } from "@jsenv/logger"

import { startOmegaServer } from "@jsenv/core/src/omega/server.js"

export const buildProject = async ({
  logLevel = "info",
  projectDirectoryUrl,
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

  const server = await startOmegaServer({
    keepProcessAlive: false,

    projectDirectoryUrl,
    plugins,
    runtimeSupport,
    scenario: preview ? "preview" : "prod",
  })
  // TODO: use rollup and stuff, perform http request to retrieve files,
  return server
}

const assertEntryPoints = ({ entryPoints }) => {
  if (typeof entryPoints !== "object") {
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
