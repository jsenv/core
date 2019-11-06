import { metaMapToSpecifierMetaMap, normalizeSpecifierMetaMap, urlToMeta } from "@jsenv/url-meta"
import { jsenvCoverDescription, createInstrumentBabelPlugin } from "@jsenv/testing"
import { launchNodeProjectPathname } from "../src/launch-node-project.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const createInstrumentPluginParam = () => {
  const specifierMetaMapForCoverage = normalizeSpecifierMetaMap(
    metaMapToSpecifierMetaMap({
      cover: jsenvCoverDescription,
    }),
    `file:///${launchNodeProjectPathname}`,
    { forceHttpResolutionForFile: true },
  )

  return {
    predicate: ({ relativePath }) =>
      urlToMeta({
        url: `file://${launchNodeProjectPathname}${relativePath}`,
        specifierMetaMap: specifierMetaMapForCoverage,
      }).cover === true,
  }
}

export const testBabelPluginMap =
  process.env.COVERAGE_ENABLED === "true"
    ? {
        ...jsenvBabelPluginMap,
        ["transform-instrument"]: [createInstrumentBabelPlugin(createInstrumentPluginParam())],
      }
    : jsenvBabelPluginMap
