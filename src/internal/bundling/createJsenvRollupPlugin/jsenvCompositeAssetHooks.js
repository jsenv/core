import { basename } from "path"
import { urlToBasename } from "@jsenv/util"
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
  parse: async (url, source, { emitAssetReference, emitJsReference }) => {
    if (url.endsWith(".html")) {
      const htmlUrl = url
      const htmlSource = String(source)
      const htmlDocument = parseHtmlString(htmlSource)
      const { scripts, styles } = parseHtmlDocumentRessources(htmlDocument)

      const nodeUrlMapping = {}
      scripts.forEach((script) => {
        if (script.attributes.type === "module" && script.attributes.src) {
          const remoteScriptUrl = emitJsReference({
            specifier: script.attributes.src,
            ...getHtmlNodeLocation(script.node),
          })
          nodeUrlMapping[remoteScriptUrl] = script
        }
        // pour décider du nom je dois voir s'il existe un autre script ayant
        // la meme ligne, si oui on ajoute la colonne
        if (script.attributes.type === "module" && script.text) {
          const inlineScriptUrl = emitJsReference({
            specifier: getUniqueInlineScriptName(script, scripts, htmlUrl),
            ...getHtmlNodeLocation(script.node),
            source: script.text,
          })
          nodeUrlMapping[inlineScriptUrl] = script
        }
      })
      styles.forEach((style) => {
        if (style.attributes.href) {
          const remoteStyleUrl = emitAssetReference({
            specifier: style.attributes.href,
            ...getHtmlNodeLocation(style.node),
          })
          nodeUrlMapping[remoteStyleUrl] = style
        }
        if (style.text) {
          const inlineStyleUrl = emitAssetReference({
            specifier: getUniqueInlineStyleName(style, styles, htmlUrl),
            ...getHtmlNodeLocation(style.node),
            source: style.text,
          })
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
        const importedCssUrl = emitAssetReference({
          specifier: atImport.specifier,
          line: atImport.urlNode,
          column: atImport.urlNode,
        })
        nodeUrlMapping[importedCssUrl] = atImport.urlNode
      })
      urlDeclarations.forEach((urlDeclaration) => {
        const cssAssetUrl = emitAssetReference({
          specifier: urlDeclaration.specifier,
          line: urlDeclaration.node,
          column: urlDeclaration,
        })
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

const getHtmlNodeLocation = (htmlNode) => {
  return {
    line: htmlNode.sourceCodeLocation.startLine,
    column: htmlNode.sourceCodeLocation.startCol,
  }
}

const getUniqueInlineScriptName = (script, scripts, htmlUrl) => {
  const htmlBasename = urlToBasename(htmlUrl)
  const { line, column } = getHtmlNodeLocation(script.node)
  const lineTaken = scripts.some(
    (scriptCandidate) =>
      scriptCandidate !== script && getHtmlNodeLocation(scriptCandidate.node).line === line,
  )
  if (lineTaken) {
    return `${htmlBasename}.line.${line}.${column}.js`
  }

  return `${htmlBasename}.line.${line}.js`
}

const getUniqueInlineStyleName = (style, styles, htmlUrl) => {
  const htmlBasename = urlToBasename(htmlUrl)
  const { line, column } = getHtmlNodeLocation(style.node)
  const lineTaken = styles.some(
    (styleCandidate) =>
      styleCandidate !== style && getHtmlNodeLocation(styleCandidate.node).line === line,
  )
  if (lineTaken) {
    return `${htmlBasename}.line.${line}.${column}.css`
  }

  return `${htmlBasename}.line.${line}.css`
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
