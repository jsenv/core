import { basename } from "path"
import { readFileSync } from "fs"
import postcss from "postcss"
import { urlToFileSystemPath, urlToRelativeUrl } from "@jsenv/util"
import { setCssSourceMappingUrl } from "../../sourceMappingURLUtils.js"
import { replaceCssUrls } from "./css/replaceCssUrls.js"
import { postCssUrlHashPlugin } from "./css/postcss-urlhash-plugin.js"

export const jsenvCompositeAssetHooks = {
  load: async (url) => {
    const source = readFileSync(urlToFileSystemPath(url))
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

      return async (dependenciesMapping, { computeFileUrlForCaching }) => {
        const cssReplaceResult = await replaceCssUrls(source, url, dependenciesMapping)
        let code = cssReplaceResult.css
        const map = cssReplaceResult.map.toJSON()
        const urlForCaching = computeFileUrlForCaching(url, code)

        map.file = basename(urlToFileSystemPath(urlForCaching))
        const cssSourceMapFileUrl = `${urlForCaching}.map`
        const cssSourceMapFileUrlRelativeToSource = urlToRelativeUrl(
          cssSourceMapFileUrl,
          urlForCaching,
        )
        // In theory code should never be modified once the url for caching is computed
        // because url for caching depends on file content.
        // There is an exception for sourcemap because we want to update sourcemap.file
        // to the cached filename of the css file.
        // To achieve that we set/update the sourceMapping url comment in compiled css file.
        // This is totally fine to do that because sourcemap and css file lives togethers
        // so this comment changes nothing regarding cache invalidation and is not important
        // to decide the filename for this css asset.
        code = setCssSourceMappingUrl(code, cssSourceMapFileUrlRelativeToSource)
        return {
          code,
          map,
          urlForCaching,
        }
      }
    }

    return null
  },
}
