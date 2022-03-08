import { require } from "../require.js"

// https://github.com/mozilla/source-map#sourcemapconsumerprototypeoriginalpositionforgeneratedposition
export const getOriginalPosition = async ({
  sourcemap,
  line,
  column,
  bias,
}) => {
  const { SourceMapConsumer } = require("source-map")

  const sourceMapConsumer = await new SourceMapConsumer(sourcemap)
  const originalPosition = sourceMapConsumer.originalPositionFor({
    line,
    column,
    bias,
  })
  return originalPosition
}
