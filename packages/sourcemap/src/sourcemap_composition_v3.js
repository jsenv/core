/*
 * https://github.com/mozilla/source-map#sourcemapgenerator
 */

import { requireSourcemap } from "./require_sourcemap.js"

const { SourceMapConsumer, SourceMapGenerator } = requireSourcemap()

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
  const sources = []
  const sourcesContent = []
  const firstSourcesContent = firstSourcemap.sourcesContent
  const secondSourcesContent = secondSourcemap.sourcesContent
  sourcemap.sources.forEach((source) => {
    sources.push(source)
    if (secondSourcesContent) {
      const secondSourceIndex = secondSourcemap.sources.indexOf(source)
      if (secondSourceIndex > -1) {
        sourcesContent.push(secondSourcesContent[secondSourceIndex])
        return
      }
    }
    if (firstSourcesContent) {
      const firstSourceIndex = firstSourcemap.sources.indexOf(source)
      if (firstSourceIndex > -1) {
        sourcesContent.push(firstSourcesContent[firstSourceIndex])
        return
      }
    }
    sourcesContent.push(null)
  })
  sourcemap.sources = sources
  sourcemap.sourcesContent = sourcesContent
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
