import { basename } from "path"
import { readFile } from "fs"
import { urlToFileSystemPath, resolveUrl } from "@jsenv/util"
import { setCssSourceMappingUrl } from "../../sourceMappingURLUtils.js"
import { parseCssUrls } from "./css/parseCssUrls.js"
import { replaceCssUrls } from "./css/replaceCssUrls.js"
import {
  parseHtmlString,
  parseHtmlDocumentRessources,
  transformHtmlDocumentModuleScripts,
  stringifyHtmlDocument,
} from "../../compiling/compileHtml.js"

export const jsenvCompositeAssetHooks = {
  load: async (url) => {
    // todo: ajouter un param as: 'buffer' dans @jsenv/util
    // et utiliser readFile de jsenv util plutot.
    // dans @jsenv/util on authorisera as: 'string', 'json','buffer' avec un defaut sur string
    const source = await new Promise((resolve, reject) => {
      readFile(urlToFileSystemPath(url), (error, buffer) => {
        if (error) {
          reject(error)
        } else {
          resolve(buffer)
        }
      })
    })
    return source
  },
  parse: async (url, source, { emitAssetReference, emitJsReference }) => {
    if (url.endsWith(".html")) {
      const htmlUrl = url
      const htmlSource = String(source)
      const htmlFileName = basename(urlToFileSystemPath(htmlUrl))
      const htmlDocument = parseHtmlString(htmlSource)
      const { scripts, styles } = parseHtmlDocumentRessources(htmlDocument)

      const nodeUrlMapping = {}
      scripts.forEach((script, index) => {
        if (script.attributes.type === "module" && script.attributes.src) {
          const remoteScriptSrc = script.attributes.src
          const remoteScriptUrl = emitJsReference(remoteScriptSrc)
          nodeUrlMapping[remoteScriptUrl] = script
        }
        if (script.attributes.type === "module" && script.text) {
          const inlineScriptId = `${htmlFileName}.${index}.js`
          const inlineScriptUrl = emitJsReference(inlineScriptId, script.text)
          nodeUrlMapping[inlineScriptUrl] = script
        }
      })
      styles.forEach((style, index) => {
        if (style.attributes.href) {
          const remoteStyleHref = style.attributes.href
          const remoteStyleUrl = resolveUrl(remoteStyleHref, htmlUrl)
          emitAssetReference(remoteStyleUrl)
          nodeUrlMapping[remoteStyleUrl] = style
        }
        if (style.text) {
          const inlineStyleId = `${htmlFileName}.${index}.css`
          const inlineStyleUrl = resolveUrl(inlineStyleId, htmlUrl)
          emitAssetReference(inlineStyleUrl, style.text)
          nodeUrlMapping[inlineStyleUrl] = style
        }
      })

      return async (dependenciesMapping) => {
        transformHtmlDocumentModuleScripts(scripts, {
          generateScriptCode: (script) => {
            const scriptUrl = Object.keys(nodeUrlMapping).find(
              (key) => nodeUrlMapping[key] === script,
            )
            const scriptFileRelativeUrlForBundle = dependenciesMapping[scriptUrl]
            return `<script>window.System.import(${JSON.stringify(
              ensureRelativeUrlNotation(scriptFileRelativeUrlForBundle),
            )})</script>`
          },
        })
        const htmlAfterTransformation = stringifyHtmlDocument(htmlDocument)
        // const code = minify ? minifyHtml(htmlTransformedString, minifyHtmlOptions) : htmlTransformedString
        return {
          sourceAfterTransformation: htmlAfterTransformation,
        }
      }
    }

    if (url.endsWith(".css")) {
      const cssSource = String(source)
      const cssUrl = url
      const { atImports, urlDeclarations } = await parseCssUrls(cssSource, cssUrl)
      const nodeUrlMapping = {}

      atImports.forEach((atImport) => {
        const importedCssUrl = emitAssetReference(atImport.specifier)
        nodeUrlMapping[importedCssUrl] = atImport.urlNode
      })
      urlDeclarations.forEach((urlDeclaration) => {
        const cssAssetUrl = emitAssetReference(urlDeclaration.specifier)
        nodeUrlMapping[cssAssetUrl] = urlDeclaration.urlNode
      })

      return async (dependenciesMapping, { precomputeFileNameForRollup }) => {
        const cssReplaceResult = await replaceCssUrls(cssSource, cssUrl, ({ urlNode }) => {
          const scriptUrl = Object.keys(nodeUrlMapping).find((key) =>
            isSameCssDocumentUrlNode(nodeUrlMapping[key], urlNode),
          )
          return dependenciesMapping[scriptUrl]
        })
        const code = cssReplaceResult.css
        const map = cssReplaceResult.map.toJSON()
        const cssFileNameForRollup = precomputeFileNameForRollup(code)
        const cssSourceMapFileUrlRelativeToSource = `${cssFileNameForRollup}.map`

        map.file = basename(cssFileNameForRollup)

        // In theory code should never be modified once the url for caching is computed
        // because url for caching depends on file content.
        // There is an exception for sourcemap because we want to update sourcemap.file
        // to the cached filename of the css file.
        // To achieve that we set/update the sourceMapping url comment in compiled css file.
        // This is totally fine to do that because sourcemap and css file lives togethers
        // so this comment changes nothing regarding cache invalidation and is not important
        // to decide the filename for this css asset.
        const cssSourceAfterTransformation = setCssSourceMappingUrl(
          code,
          cssSourceMapFileUrlRelativeToSource,
        )
        return {
          sourceAfterTransformation: cssSourceAfterTransformation,
          map,
          fileNameForRollup: cssFileNameForRollup,
        }
      }
    }

    return null
  },
}

// otherwise systemjs thinks it's a bare import
const ensureRelativeUrlNotation = (relativeUrl) => {
  if (relativeUrl.startsWith("../")) {
    return relativeUrl
  }
  return `./${relativeUrl}`
}

const isSameCssDocumentUrlNode = (firstUrlNode, secondUrlNode) => {
  if (firstUrlNode.type !== secondUrlNode.type) {
    return false
  }
  if (firstUrlNode.value !== secondUrlNode.value) {
    return false
  }
  if (firstUrlNode.sourceIndex !== secondUrlNode.sourceIndex) {
    return false
  }
  return true
}
