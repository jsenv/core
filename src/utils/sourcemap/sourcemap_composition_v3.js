/*
 * https://github.com/mozilla/source-map#sourcemapgenerator
 */

import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { SourceMapConsumer, SourceMapGenerator } = require("source-map")

export const composeTwoSourcemaps = async (firstSourcemap, secondSourcemap) => {
  if (!firstSourcemap && !secondSourcemap) {
    return null
  }
  if (!firstSourcemap) {
    return secondSourcemap
  }
  if (!secondSourcemap) {
    return firstSourcemap
  }
  const sourcemapGenerator = new SourceMapGenerator()
  const firstSourcemapConsumer = await new SourceMapConsumer(firstSourcemap)
  const secondSourcemapConsumer = await new SourceMapConsumer(secondSourcemap)
  const firstMappings = readMappings(firstSourcemapConsumer)
  firstMappings.forEach((mapping) => {
    sourcemapGenerator.addMapping(mapping)
  })
  const secondMappings = readMappings(secondSourcemapConsumer)
  secondMappings.forEach((mapping) => {
    sourcemapGenerator.addMapping(mapping)
  })
  const sourcemap = sourcemapGenerator.toJSON()
  return sourcemap
}

const readMappings = (consumer) => {
  const mappings = []
  consumer.eachMapping(
    ({
      originalColumn,
      originalLine,
      generatedColumn,
      generatedLine,
      source,
      name,
    }) => {
      mappings.push({
        original:
          typeof originalColumn === "number"
            ? {
                column: originalColumn,
                line: originalLine,
              }
            : undefined,
        generated: {
          column: generatedColumn,
          line: generatedLine,
        },
        source: typeof originalColumn === "number" ? source : undefined,
        name,
      })
    },
  )
  return mappings
}
