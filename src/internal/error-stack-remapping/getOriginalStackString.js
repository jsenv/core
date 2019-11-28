import { parseSourceMappingURL } from "internal/sourcemappingURLUtils.js"
import { remapCallSite } from "./remapCallSite.js"
import { stackToString } from "./stackToString.js"

export const generateOriginalStackString = async ({
  stack,
  error,
  resolveUrl,
  fetchUrl,
  SourceMapConsumer,
  base64ToString,
  indent,
  readErrorStack,
  onFailure,
}) => {
  const sourceToSourceMapConsumer = memoizeByHref(async (path) => {
    try {
      const compiledFileUrl = resolveUrl({ type: "compiled-file", specifier: path })
      let text
      try {
        const fileResponse = await fetchUrl("compiled-file", compiledFileUrl)
        const { status } = fileResponse
        if (status !== 200) {
          if (status === 404) {
            onFailure({
              code: "COMPILED_FILE_NOT_FOUND",
              message: `compiled file not found at ${compiledFileUrl}`,
            })
          } else {
            onFailure({
              code: "UNEXPECTED_COMPILED_FILE_RESPONSE",
              message: `compiled file unexpected response.
--- response status ---
${status}
--- response text ---
${await fileResponse.text()}
--- compiled file url ---
${compiledFileUrl}`,
            })
          }
          return null
        }
        text = await fileResponse.text()
      } catch (e) {
        onFailure(
          createErrorWhileFetchingCompiledFileFailure({
            fetchErrorStack: readErrorStack(e),
            href,
          }),
        )
        return null
      }

      const sourceMappingURL = parseSourceMappingURL(text)
      if (!sourceMappingURL) return null

      let sourceMapHref
      let sourceMapString
      if (sourceMappingURL.type === "base64") {
        sourceMapHref = href
        sourceMapString = base64ToString(sourceMappingURL.value)
      } else {
        sourceMapHref = resolveHref({
          type: "source-map",
          specifier: sourceMappingURL.value,
          importer: href,
        })

        try {
          const sourceMapResponse = await fetchHref(sourceMapHref)
          const { status } = sourceMapResponse
          if (status !== 200) {
            if (status === 404) {
              onFailure(createSourceMapNotFoundFailure({ href: sourceMapHref }))
            } else {
              onFailure(
                createUnexpectedSourceMapResponseFailure({
                  status,
                  responseText: await sourceMapResponse.text(),
                  href: sourceMapHref,
                }),
              )
            }
            return null
          }
          sourceMapString = await sourceMapResponse.text()
        } catch (e) {
          onFailure(
            createErrorWhileFetchingSourceMapFailure({
              fetchErrorStack: readErrorStack(e),
              href: sourceMapHref,
            }),
          )
          return null
        }
      }

      let sourceMap
      try {
        sourceMap = JSON.parse(sourceMapString)
      } catch (e) {
        onFailure(
          createErrorWhileParsingSourceMapFailure({
            parseErrorStack: readErrorStack(e),
            href: sourceMapHref,
          }),
        )
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

          const sourceMapSourceHref = resolveHref({
            type: "source",
            specifier: source,
            importer: sourceMapHref,
          })
          try {
            const sourceResponse = await fetchHref(sourceMapSourceHref)
            const { status } = sourceResponse
            if (status !== 200) {
              if (firstSourceMapSourceFailure) return

              if (status === 404) {
                firstSourceMapSourceFailure = createSourceMapSourceNotFoundFailure({
                  sourceMapHref,
                  sourceMapSourceHref,
                })
                return
              }
              firstSourceMapSourceFailure = createUnexpectedSourceMapSourceResponseFailure({
                status,
                responseText: await sourceResponse.text(),
                sourceMapHref,
                sourceMapSourceHref,
              })
              return
            }

            const sourceString = await sourceResponse.text()
            sourcesContent[index] = sourceString
          } catch (e) {
            if (firstSourceMapSourceFailure) return
            firstSourceMapSourceFailure = createErrorWhileFetchingSourceMapSourceFailure({
              fetchErrorStack: readErrorStack(e),
              sourceMapHref,
              sourceMapSourceHref,
            })
          }
        }),
      )

      if (firstSourceMapSourceFailure) {
        onFailure(firstSourceMapSourceFailure)
        return null
      }

      return new SourceMapConsumer(sourceMap)
    } catch (e) {
      onFailure(
        createErrorWhilePreparingSourceMapConsumerFailure({
          errorStack: readErrorStack(e),
          path,
        }),
      )
      return null
    }
  })

  try {
    const originalStack = await Promise.all(
      stack.map((callSite) =>
        remapCallSite(callSite, {
          resolveHref,
          sourceToSourceMapConsumer,
          readErrorStack,
          onFailure,
        }),
      ),
    )
    return stackToString({ stack: originalStack, error, indent })
  } catch (e) {
    const unmappedStack = stackToString({ stack, error, indent })
    onFailure(
      createErrorWhileComputingOriginalStackFailure({
        errorWhileComputingStack: readErrorStack(e),
        errorStack: unmappedStack,
      }),
    )
    // in case of error return the non remapped stack
    return unmappedStack
  }
}

const memoizeByHref = (fn) => {
  const hrefCache = {}
  return (href) => {
    if (href in hrefCache) return hrefCache[href]
    const value = fn(href)
    hrefCache[href] = value
    return value
  }
}

const createErrorWhileFetchingCompiledFileFailure = ({ fetchErrorStack, href }) => {
  return {
    code: "ERROR_WHILE_FETCHING_COMPILED_FILE",
    message: `error while fetching compiled file.
--- fetch error stack ---
${fetchErrorStack}
--- compiled file href ---
${href}`,
  }
}

const createSourceMapNotFoundFailure = ({ href }) => {
  return {
    code: "SOURCE_MAP_NOT_FOUND_FAILURE",
    message: `sourcemap file not found.
--- sourceMap href ---
${href}`,
  }
}

const createUnexpectedSourceMapResponseFailure = ({ status, responseText, href }) => {
  return {
    code: "UNEXPECTED_SOURCE_MAP_RESPONSE",
    message: `unexpected response for sourcemap file.
--- response status ---
${status}
--- response text ---
${responseText}
--- sourceMap href ---
${href}`,
  }
}

const createErrorWhileFetchingSourceMapFailure = ({ fetchErrorStack, href }) => {
  return {
    code: "ERROR_WHILE_FETCHING_SOURCE_MAP",
    message: `error while fetching sourcemap.
--- fetch error stack ---
${fetchErrorStack}
--- sourceMap href ---
${href}`,
  }
}

const createErrorWhileParsingSourceMapFailure = ({ parseErrorStack, href }) => {
  return {
    code: "ERROR_WHILE_PARSING_SOURCE_MAP",
    message: `error while parsing sourcemap.
--- parse error stack ---
${parseErrorStack}
--- sourceMap href ---
${href}`,
  }
}

const createSourceMapSourceNotFoundFailure = ({ sourceMapSourceHref, sourceMapHref }) => {
  return {
    code: "SOURCE_MAP_SOURCE_NOT_FOUND",
    message: `sourcemap source not found.
--- sourcemap source href ---
${sourceMapSourceHref}
--- sourcemap href ---
${sourceMapHref}`,
  }
}

const createUnexpectedSourceMapSourceResponseFailure = ({
  status,
  responseText,
  sourceMapSourceHref,
  sourceMapHref,
}) => {
  return {
    code: "UNEXPECTED_SOURCE_MAP_SOURCE_RESPONSE",
    message: `unexpected response for sourcemap source.
--- response status ---
${status}
--- response text ---
${responseText}
--- sourceMap source href ---
${sourceMapSourceHref}
--- sourceMap href ---
${sourceMapHref}`,
  }
}

const createErrorWhileFetchingSourceMapSourceFailure = ({
  fetchErrorStack,
  sourceMapSourceHref,
  sourceMapHref,
}) => {
  return {
    code: "ERROR_WHILE_FETCHING_SOURCE_MAP_SOURCE",
    message: `error while fetching sourcemap source.
--- fetch error stack ---
${fetchErrorStack}
--- sourceMap source href ---
${sourceMapSourceHref}
--- sourceMap href ---
${sourceMapHref}`,
  }
}

const createErrorWhilePreparingSourceMapConsumerFailure = ({ errorStack, path }) => {
  return {
    code: "ERROR_WHILE_PREPARING_SOURCEMAP_CONSUMER",
    message: `error while preparing sourceMap consumer.
--- error stack ---
${errorStack}
--- source path ---
${path}`,
  }
}

const createErrorWhileComputingOriginalStackFailure = ({
  errorWhileComputingStack,
  errorStack,
}) => {
  return {
    code: "ERROR_WHILE_COMPUTING_ORIGINAL_STACK",
    message: `error while computing original stack.
--- stack from error while computing ---
${errorWhileComputingStack}
--- stack from error to remap ---
${errorStack}`,
  }
}
