import { require } from "@jsenv/core/src/internal/require.js"

export const composeTwoSourcemaps = (firstSourcemap, secondSourcemap) => {
  const { SourceMapConsumer } = require("source-map")

  const sourcemapGenerator = SourceMapConsumer.fromSourceMap(firstSourcemap)
  // https://github.com/mozilla/source-map#sourcemapgeneratorprototypeapplysourcemapsourcemapconsumer-sourcefile-sourcemappath
  sourcemapGenerator.applySourceMap(secondSourcemap)
  return sourcemapGenerator.toJSON()
}
