import { basename } from "path"
import { urlToBasename, urlToRelativeUrl, resolveUrl } from "@jsenv/util"
import { setCssSourceMappingUrl } from "../../sourceMappingURLUtils.js"
import { parseCssUrls } from "./css/parseCssUrls.js"
import { replaceCssUrls } from "./css/replaceCssUrls.js"
import {
  parseHtmlString,
  parseHtmlDocumentRessources,
  transformHtmlDocumentModuleScripts,
  transformHtmlDocumentImportmapScript,
  stringifyHtmlDocument,
} from "../../compiling/compileHtml.js"

export const jsenvCompositeAssetHooks = {
  parse: async (
    { url, source },
    { notifyAssetFound, notifyInlineAssetFound, notifyJsFound, notifyInlineJsFound },
  ) => {
    if (url.endsWith(".html")) {
      const htmlUrl = url
      const htmlSource = String(source)
      const htmlDocument = parseHtmlString(htmlSource)
      const { scripts, styles } = parseHtmlDocumentRessources(htmlDocument)

      const nodeUrlMapping = {}
      scripts.forEach((script) => {
        if (script.attributes.type === "module") {
          if (script.attributes.src) {
            const remoteScriptUrl = notifyJsFound({
              specifier: script.attributes.src,
              ...getHtmlNodeLocation(script.node),
            })
            nodeUrlMapping[remoteScriptUrl] = script
          }
          // pour décider du nom je dois voir s'il existe un autre script ayant
          // la meme ligne, si oui on ajoute la colonne
          else if (script.text) {
            const inlineScriptUrl = notifyInlineJsFound({
              specifier: getUniqueInlineScriptName(script, scripts, htmlUrl),
              ...getHtmlNodeLocation(script.node),
              source: script.text,
            })
            nodeUrlMapping[inlineScriptUrl] = script
          }
        }
        if (script.attributes.type === "importmap") {
          // pour importmap il faudra un truc en particulier
          // en gros en fonction de ou elle finie il faut adapter son contenu
          // parce qu'il doit rester relatif a la ou elle était a la base en gros
          // je pense que ce sera un hook dans target
          // genre target.renderFile
          // qui peut transformer le fichier avant qu'il soit emit dans rollup
          // mais ce au moment ou on connait le contenu final
          // en vrai ça peut tres bien se trouver ici meme
          // et reproduire ce qu'on fait pour les css importmap
          // non ?
          // oui et non parce que sourcemap sont autorisé a sortir
          // du bundle directory et donc ont besoin de le connaitre
          // alors que importmap pas vraiment ?
          if (script.attributes.src) {
            const remoteImportmapUrl = notifyAssetFound({
              specifier: script.attributes.src,
              ...getHtmlNodeLocation(script.node),
            })
            nodeUrlMapping[remoteImportmapUrl] = script
          } else if (script.text) {
            const inlineImportMapUrl = notifyInlineAssetFound({
              specifier: getUniqueInlineScriptName(script, scripts, htmlUrl),
              ...getHtmlNodeLocation(script.node),
              source: script.text,
            })
            nodeUrlMapping[inlineImportMapUrl] = script
          }
        }
      })
      styles.forEach((style) => {
        if (style.attributes.href) {
          const remoteStyleUrl = notifyAssetFound({
            specifier: style.attributes.href,
            ...getHtmlNodeLocation(style.node),
          })
          nodeUrlMapping[remoteStyleUrl] = style
        }
        if (style.text) {
          const inlineStyleUrl = notifyInlineAssetFound({
            specifier: getUniqueInlineStyleName(style, styles, htmlUrl),
            ...getHtmlNodeLocation(style.node),
            source: style.text,
          })
          nodeUrlMapping[inlineStyleUrl] = style
        }
      })

      return async (dependenciesMapping) => {
        transformHtmlDocumentModuleScripts(scripts, {
          transformScript: (script) => {
            const scriptUrl = Object.keys(nodeUrlMapping).find(
              (key) => nodeUrlMapping[key] === script,
            )
            const scriptFileRelativeUrlForBundle = dependenciesMapping[scriptUrl]
            return `<script>window.System.import(${JSON.stringify(
              ensureRelativeUrlNotation(scriptFileRelativeUrlForBundle),
            )})</script>`
          },
        })
        // on aurait presque envie de pouvoir inline l'asset si on a l'info
        // et sinon de le garder en remote
        // en tous cas de pouvoir controler ça
        transformHtmlDocumentImportmapScript(scripts, (script) => {
          const scriptUrl = Object.keys(nodeUrlMapping).find(
            (key) => nodeUrlMapping[key] === script,
          )
          return `<script type="systemjs-importmap" src="${dependenciesMapping[scriptUrl]}"></script>`
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
        const importedCssUrl = notifyAssetFound({
          specifier: atImport.specifier,
          line: atImport.urlDeclarationNode.source.start.line,
          column: atImport.urlDeclarationNode.source.start.column,
        })
        nodeUrlMapping[importedCssUrl] = atImport.urlNode
      })
      urlDeclarations.forEach((urlDeclaration) => {
        const cssAssetUrl = notifyAssetFound({
          specifier: urlDeclaration.specifier,
          line: urlDeclaration.urlDeclarationNode.source.start.line,
          column: urlDeclaration.urlDeclarationNode.source.start.column,
        })
        nodeUrlMapping[cssAssetUrl] = urlDeclaration.urlNode
      })

      return async (dependenciesMapping, { precomputeFileNameForRollup, registerAssetEmitter }) => {
        const cssReplaceResult = await replaceCssUrls(cssSource, cssUrl, ({ urlNode }) => {
          const scriptUrl = Object.keys(nodeUrlMapping).find((key) =>
            isSameCssDocumentUrlNode(nodeUrlMapping[key], urlNode),
          )
          return dependenciesMapping[scriptUrl]
        })
        const code = cssReplaceResult.css
        const map = cssReplaceResult.map.toJSON()
        const cssFileNameForRollup = precomputeFileNameForRollup(code)

        const cssSourcemapFilename = `${basename(cssFileNameForRollup)}.map`

        // In theory code should never be modified once the url for caching is computed
        // because url for caching depends on file content.
        // There is an exception for sourcemap because we want to update sourcemap.file
        // to the cached filename of the css file.
        // To achieve that we set/update the sourceMapping url comment in compiled css file.
        // This is totally fine to do that because sourcemap and css file lives togethers
        // so this comment changes nothing regarding cache invalidation and is not important
        // to decide the filename for this css asset.
        const cssSourceAfterTransformation = setCssSourceMappingUrl(code, cssSourcemapFilename)

        registerAssetEmitter(({ importerProjectUrl, importerBundleUrl }) => {
          const mapBundleUrl = resolveUrl(cssSourcemapFilename, importerBundleUrl)
          map.file = basename(importerBundleUrl)
          map.sources = map.sources.map((source) => {
            const sourceUrl = resolveUrl(source, importerProjectUrl)
            const sourceUrlRelativeToSourceMap = urlToRelativeUrl(sourceUrl, mapBundleUrl)
            return sourceUrlRelativeToSourceMap
          })

          const assetSource = JSON.stringify(map, null, "  ")
          const assetUrl = mapBundleUrl
          return { assetSource, assetUrl }
        })

        return {
          sourceAfterTransformation: cssSourceAfterTransformation,
          map,
          fileNameForRollup: cssFileNameForRollup,
        }
      }
    }

    // if (url.endsWith(".importmap")) {
    //   // de base cet importmap avait une url particuliere relative au projet
    //   // c'est par rapport a cette url qu'on veut s'ajuster
    //   // et voir ou on se trouve par rapport au bundle directory
    //   relativeUrl
    //   debugger
    //   return (dependenciesMapping, { precomputeFileNameForRollup }) => {
    //     const importmapUrl = url
    //     const importmapRelativeUrl = relativeUrl

    //     // foo/bar/importmap.importmap
    //     // ../../bar.js
    //     // /importmap.importmap
    //     // ./bar.js
    //     const importmapSource = source
    //     const importmap = JSON.parse(importmapSource)
    //     const importmapFilenameForRollup = precomputeFileNameForRollup(importmapUrl, "")
    //     const importmapAfterTransformation = makeImportMapRelativeTo(
    //       importmap,
    //       resolveUrl(importmapFilenameForRollup, importmapUrl),
    //     )

    //     return {
    //       sourceAfterTransformation: JSON.stringify(importmapAfterTransformation, null, "  "),
    //     }
    //   }
    // }

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
