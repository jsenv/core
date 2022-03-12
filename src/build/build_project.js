/*
 * As a first step, and maybe forever we will try to
 * output esmodule and fallback to systemjs
 * The fallback to systemjs will be done later
 * The other formats we'll see afterwards
 */

import { writeFileSync } from "node:fs"
import {
  assertAndNormalizeDirectoryUrl,
  ensureEmptyDirectory,
} from "@jsenv/filesystem"
import { createLogger } from "@jsenv/logger"

import { buildGraph } from "./build_graph.js"
import { buildWithRollup } from "./build_with_rollup.js"

export const buildProject = async ({
  signal = new AbortController().signal,
  logLevel = "info",
  projectDirectoryUrl,
  buildDirectoryUrl,
  entryPoints = {},
  // for now it's here but I think preview will become an other script
  // that will just pass different options to build project
  // and this function will be agnostic about "preview" concept
  isPreview = false,
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
  sourcemapInjection = isPreview ? "comment" : false,

  writeOnFileSystem = false,
  buildDirectoryClean = true,
}) => {
  const logger = createLogger({ logLevel })
  projectDirectoryUrl = assertAndNormalizeDirectoryUrl(projectDirectoryUrl)
  assertEntryPoints({ entryPoints })
  buildDirectoryUrl = assertAndNormalizeDirectoryUrl(buildDirectoryUrl)

  const projectGraph = await buildGraph({
    signal,
    logger,
    projectDirectoryUrl,
    entryPoints,
    plugins,
    runtimeSupport,
    sourcemapInjection,
  })
  // const buildStats = await buildWithRollup({
  //   signal,
  //   logger,
  //   projectDirectoryUrl,
  //   buildDirectoryUrl,
  //   projectGraph,
  //   runtimeSupport,
  //   sourcemapInjection,
  // })
  // if (writeOnFileSystem) {
  //   if (buildDirectoryClean) {
  //     await ensureEmptyDirectory(buildDirectoryUrl)
  //   }
  //   const { buildFileContents } = buildStats
  //   const buildRelativeUrls = Object.keys(buildFileContents)
  //   buildRelativeUrls.forEach((buildRelativeUrl) => {
  //     writeFileSync(
  //       new URL(buildRelativeUrl, buildDirectoryUrl),
  //       buildFileContents[buildRelativeUrl],
  //     )
  //   })
  // }
  // return buildStats
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
