import { namedValueDescriptionToMetaDescription, pathnameToMeta } from "@dmail/project-structure"
import { jsenvCoverDescription } from "../index.js"
import { createInstrumentPlugin } from "../src/coverage/createInstrumentPlugin.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const computeTestBabelPluginMap = ({ coverageEnabled }) => {
  if (!coverageEnabled) return jsenvBabelPluginMap

  const coverMetaDescription = namedValueDescriptionToMetaDescription({
    cover: jsenvCoverDescription,
  })

  return {
    ...jsenvBabelPluginMap,
    ["transform-instrument"]: createInstrumentPlugin({
      predicate: ({ relativePath }) =>
        pathnameToMeta({
          pathname: relativePath,
          metaDescription: coverMetaDescription,
        }).cover === true,
    }),
  }
}

export const testBabelPluginMap = computeTestBabelPluginMap({
  coverageEnabled: process.env.COVERAGE_ENABLED === "true",
})
