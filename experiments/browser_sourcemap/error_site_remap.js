import { memoize } from "@jsenv/utils/src/memoize/memoize.js"
import { remapSourcePosition } from "@jsenv/sourcemap/src/error_stack_remap/remap_source_position.js"
import { SOURCEMAP } from "@jsenv/sourcemap/src/sourcemap_comment.js"
import { DATA_URL } from "@jsenv/urls/src/data_url.js"

const sourcemapJsFileUrl = new URL(
  "./source-map@0.7.3.js?js_classic",
  import.meta.url,
)
const sourcemapWasmFileUrl = new URL("./source-map@0.7.3.wasm", import.meta.url)

const loadSourceMapConsumer = memoize(async () => {
  const script = document.createElement("script")
  script.src = sourcemapJsFileUrl.href

  const scriptLoadedPromise = new Promise((resolve) => {
    script.onload = resolve
  })
  document.head.appendChild(script)
  await scriptLoadedPromise
  const { SourceMapConsumer } = window.sourceMap
  await SourceMapConsumer.initialize({
    "lib/mappings.wasm": sourcemapWasmFileUrl.href,
  })
  return SourceMapConsumer
})

export const remapErrorSite = async ({ url, line, column }) => {
  const asServerUrl = (url) => {
    if (url.startsWith("file:///")) {
      url = `${window.origin}/@fs/${url.slice("file:///".length)}`
    }
    return url
  }

  const original = await remapSourcePosition({
    url,
    line,
    column,
    resolveFile: (specifier) => new URL(specifier, `${window.origin}/`).href,
    urlToSourcemapConsumer: async (url) => {
      const serverUrl = asServerUrl(url)
      const fileResponse = await window.fetch(serverUrl)
      const text = await fileResponse.text()
      const jsSourcemapComment = SOURCEMAP.readComment({
        contentType: "text/javascript",
        content: text,
      })
      if (!jsSourcemapComment) {
        return null
      }

      const jsSourcemapUrl = jsSourcemapComment.specifier
      let sourcemapUrl
      let sourcemapUrlContent
      if (jsSourcemapUrl.startsWith("data:")) {
        sourcemapUrl = url
        sourcemapUrlContent = window.atob(DATA_URL.parse(jsSourcemapUrl).data)
      } else {
        sourcemapUrl = new URL(jsSourcemapUrl, url).href
        const sourcemapResponse = await window.fetch(sourcemapUrl)
        sourcemapUrlContent = await sourcemapResponse.text()
      }

      const sourceMap = JSON.parse(sourcemapUrlContent)
      let { sourcesContent } = sourceMap
      if (!sourcesContent) {
        sourcesContent = []
        sourceMap.sourcesContent = sourcesContent
      }
      let firstSourceMapSourceFailure = null
      await Promise.all(
        sourceMap.sources.map(async (source, index) => {
          if (index in sourcesContent) return
          let sourceUrl = new URL(source, sourcemapUrl).href
          sourceUrl = asServerUrl(sourceUrl)
          try {
            const sourceResponse = await window.fetch(sourceUrl)
            const sourceContent = await sourceResponse.text()
            sourcesContent[index] = sourceContent
          } catch (e) {
            firstSourceMapSourceFailure = e
          }
        }),
      )
      if (firstSourceMapSourceFailure) {
        return null
      }

      const SourceMapConsumer = await loadSourceMapConsumer()
      return new SourceMapConsumer(sourceMap)
    },
  })
  return original
}
