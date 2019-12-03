import { parseSourceMappingURL } from "internal/sourceMappingURLUtils.js"
import { remapCallSite } from "./remapCallSite.js"
import { stackToString } from "./stackToString.js"

export const generateOriginalStackString = async ({
  stack,
  error,
  resolveFile,
  fetchFile,
  SourceMapConsumer,
  indent,
  readErrorStack,
  onFailure,
}) => {
  const urlToSourcemapConsumer = memoizeByFirstArgStringValue(async (compiledFileUrl) => {
    try {
      let text
      try {
        const fileResponse = await fetchFile(compiledFileUrl)
        const { status } = fileResponse
        if (status !== 200) {
          if (status === 404) {
            onFailure(`compiled file not found at ${compiledFileUrl}`)
          } else {
            onFailure(`compiled file unexpected response.
--- response status ---
${status}
--- response text ---
${fileResponse.body}
--- compiled file url ---
${compiledFileUrl}`)
          }
          return null
        }
        text = fileResponse.body
      } catch (e) {
        onFailure(`error while fetching compiled file.
--- fetch error stack ---
${readErrorStack(e)}
--- compiled file url ---
${compiledFileUrl}`)

        return null
      }

      const sourcemapParsingResult = parseSourceMappingURL(text)
      if (!sourcemapParsingResult) return null

      let sourcemapUrl
      let sourcemapString
      if (sourcemapParsingResult.sourcemapString) {
        sourcemapUrl = compiledFileUrl
        sourcemapString = sourcemapParsingResult.sourcemapString
      } else {
        sourcemapUrl = resolveFile({
          type: "source-map",
          specifier: sourcemapParsingResult.sourcemapURL,
          importer: compiledFileUrl,
        })

        try {
          const sourcemapResponse = await fetchFile(sourcemapUrl)
          const { status } = sourcemapResponse
          if (status !== 200) {
            if (status === 404) {
              onFailure(`sourcemap file not found at ${sourcemapUrl}`)
            } else {
              onFailure(`unexpected response for sourcemap file.
--- response status ---
${status}
--- response text ---
${sourcemapResponse.body}
--- sourcemap url ---
${sourcemapUrl}`)
            }
            return null
          }
          sourcemapString = sourcemapResponse.body
        } catch (e) {
          onFailure(`error while fetching sourcemap.
--- fetch error stack ---
${readErrorStack(e)}
--- sourcemap url ---
${sourcemapUrl}`)
          return null
        }
      }

      let sourceMap
      try {
        sourceMap = JSON.parse(sourcemapString)
      } catch (e) {
        onFailure(`error while parsing sourcemap.
--- parse error stack ---
${readErrorStack(e)}
--- sourcemap url ---
${sourcemapUrl}`)
        return null
      }

      let { sourcesContent } = sourceMap

      if (!sourcesContent) {
        sourcesContent = []
        sourceMap.sourcesContent = sourcesContent
      }

      let firstSourceMapSourceFailure = null

      await Promise.all(
        sourceMap.sources.map(async (source, index) => {
          if (index in sourcesContent) return

          const sourcemapSourceUrl = resolveFile({
            type: "source",
            specifier: source,
            importer: sourcemapUrl,
          })
          try {
            const sourceResponse = await fetchFile(sourcemapSourceUrl)
            const { status } = sourceResponse
            if (status !== 200) {
              if (firstSourceMapSourceFailure) return

              if (status === 404) {
                firstSourceMapSourceFailure = `sourcemap source not found.
--- sourcemap source url ---
${sourcemapSourceUrl}
--- sourcemap url ---
${sourcemapUrl}`
                return
              }
              firstSourceMapSourceFailure = `unexpected response for sourcemap source.
  --- response status ---
  ${status}
  --- response text ---
  ${sourceResponse.body}
  --- sourcemap source url ---
  ${sourcemapSourceUrl}
  --- sourcemap url ---
  ${sourcemapUrl}`
              return
            }

            const sourceString = sourceResponse.body
            sourcesContent[index] = sourceString
          } catch (e) {
            if (firstSourceMapSourceFailure) return
            firstSourceMapSourceFailure = `error while fetching sourcemap source.
--- fetch error stack ---
${readErrorStack(e)}
--- sourcemap source url ---
${sourcemapSourceUrl}
--- sourcemap url ---
${sourcemapUrl}`
          }
        }),
      )

      if (firstSourceMapSourceFailure) {
        onFailure(firstSourceMapSourceFailure)
        return null
      }

      return new SourceMapConsumer(sourceMap)
    } catch (e) {
      onFailure(`error while preparing sourceMap consumer.
--- error stack ---
${readErrorStack(e)}
--- compiled file url ---
${compiledFileUrl}`)
      return null
    }
  })

  try {
    const originalStack = await Promise.all(
      stack.map((callSite) =>
        remapCallSite(callSite, {
          resolveFile,
          urlToSourcemapConsumer,
          readErrorStack,
          onFailure,
        }),
      ),
    )
    return stackToString(originalStack, { error, indent })
  } catch (e) {
    const unmappedStack = stackToString(stack, { error, indent })
    onFailure(`error while computing original stack.
--- stack from error while computing ---
${readErrorStack(e)}
--- stack from error to remap ---
${unmappedStack}`)
    // in case of error return the non remapped stack
    return unmappedStack
  }
}

const memoizeByFirstArgStringValue = (fn) => {
  const stringValueCache = {}
  return (firstArgValue) => {
    if (firstArgValue in stringValueCache) return stringValueCache[firstArgValue]
    const value = fn(firstArgValue)
    stringValueCache[firstArgValue] = value
    return value
  }
}
