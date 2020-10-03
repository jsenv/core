import postcss from "postcss"
import { readFile, urlToFileSystemPath } from "@jsenv/util"
import { replaceCssUrls } from "./css/replaceCssUrls.js"
import { postCssUrlHashPlugin } from "./css/postcss-urlhash-plugin.js"

export const jsenvCompositeAssetHooks = {
  load: async (url) => {
    const source = await readFile(url)
    return source
  },
  parse: async (url, source, { emitAssetReference }) => {
    if (url.endsWith(".css")) {
      const result = await postcss([postCssUrlHashPlugin]).process(source, {
        collectUrls: true,
        from: urlToFileSystemPath(url),
      })

      result.messages.forEach(({ type, urlRaw }) => {
        if (type === "import") {
          emitAssetReference(urlRaw)
        }
        if (type === "asset") {
          emitAssetReference(urlRaw)
        }
      })
    }
  },
  transform: async (url, source, dependenciesMapping) => {
    if (url.endsWith(".css")) {
      const cssReplaceResult = await replaceCssUrls(source, url, dependenciesMapping)
      return {
        code: cssReplaceResult.css,
        map: cssReplaceResult.map.toJSON(),
      }
    }
    return null
  },
}
