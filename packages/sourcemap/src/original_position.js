import { requireSourcemap } from "./require_sourcemap.js"

// https://github.com/mozilla/source-map#sourcemapconsumerprototypeoriginalpositionforgeneratedposition
export const getOriginalPosition = ({ sourcemap, line, column, bias }) => {
  const { SourceMapConsumer } = requireSourcemap()

  const sourceMapConsumer = new SourceMapConsumer(sourcemap)
  const originalPosition = sourceMapConsumer.originalPositionFor({
    line,
    column,
    bias,
  })
  return originalPosition
}
