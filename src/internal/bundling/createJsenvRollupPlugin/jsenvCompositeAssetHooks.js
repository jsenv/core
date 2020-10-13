import { basename } from "path"
import { urlToBasename, urlToRelativeUrl, resolveUrl, urlToParentUrl } from "@jsenv/util"
import { setCssSourceMappingUrl } from "../../sourceMappingURLUtils.js"
import { parseCssUrls } from "./css/parseCssUrls.js"
import { replaceCssUrls } from "./css/replaceCssUrls.js"
import { renderNamePattern } from "./computeFileNameForRollup.js"
import {
  parseHtmlString,
  parseHtmlDocumentRessources,
  replaceHtmlNode,
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
      const { scripts, stylesheetLinks, styles } = parseHtmlDocumentRessources(htmlDocument)

      const htmlMutationMap = new Map()
      scripts.forEach((script) => {
        if (script.attributes.type === "module") {
          if (script.attributes.src) {
            const remoteScriptReference = notifyJsFound({
              specifier: script.attributes.src,
              ...getHtmlNodeLocation(script.node),
            })

            htmlMutationMap.set(remoteScriptReference, ({ urlRelativeToImporter }) => {
              replaceHtmlNode(
                script.node,
                `<script>window.System.import(${JSON.stringify(
                  ensureRelativeUrlNotation(urlRelativeToImporter),
                )})</script>`,
              )
            })
          }
          // pour décider du nom je dois voir s'il existe un autre script ayant
          // la meme ligne, si oui on ajoute la colonne
          else if (script.text) {
            const inlineScriptReference = notifyInlineJsFound({
              specifier: getUniqueNameForInlineHtmlNode(
                script,
                scripts,
                `${urlToBasename(htmlUrl)}.[id].js`,
              ),
              ...getHtmlNodeLocation(script.node),
              source: script.text,
            })
            htmlMutationMap.set(inlineScriptReference, ({ urlRelativeToImporter }) => {
              replaceHtmlNode(
                script.node,
                `<script>window.System.import(${JSON.stringify(
                  ensureRelativeUrlNotation(urlRelativeToImporter),
                )})</script>`,
              )
            })
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
            const remoteImportmapReference = notifyAssetFound({
              specifier: script.attributes.src,
              ...getHtmlNodeLocation(script.node),
              // here we want to force the fileName for the importmap
              // so that we don't have to rewrite its content
              // the goal is to put the importmap at the same relative path
              // than in the project
              fileNamePattern: () => {
                const importmapUrl = remoteImportmapReference.url
                const importmapRelativeUrl = urlToRelativeUrl(
                  remoteImportmapReference.target.url,
                  importmapUrl,
                )
                const importmapParentRelativeUrl = urlToRelativeUrl(
                  urlToParentUrl(resolveUrl(importmapRelativeUrl, "file://")),
                  "file://",
                )
                return `${importmapParentRelativeUrl}[name]-[hash][extname]`
              },
            })
            htmlMutationMap.set(remoteImportmapReference, ({ urlRelativeToImporter }) => {
              replaceHtmlNode(
                script.node,
                `<script type="systemjs-importmap" src="${urlRelativeToImporter}"></script>`,
              )
            })
          } else if (script.text) {
            const inlineImportMapReference = notifyInlineAssetFound({
              specifier: getUniqueNameForInlineHtmlNode(
                script,
                scripts,
                `${urlToBasename(htmlUrl)}.[id].importmap`,
              ),
              ...getHtmlNodeLocation(script.node),
              source: script.text,
            })
            htmlMutationMap.set(inlineImportMapReference, ({ sourceAfterTransformation }) => {
              replaceHtmlNode(
                script.node,
                `<script type="systemjs-importmap">${sourceAfterTransformation}</script>`,
              )
            })
          }
        }
      })
      stylesheetLinks.forEach((stylesheetLink) => {
        if (stylesheetLink.attributes.href) {
          const remoteStyleReference = notifyAssetFound({
            specifier: stylesheetLink.attributes.href,
            ...getHtmlNodeLocation(stylesheetLink.node),
          })
          htmlMutationMap.set(remoteStyleReference, ({ urlRelativeToImporter }) => {
            replaceHtmlNode(stylesheetLink.node, `<link href="${urlRelativeToImporter}"/>`)
          })
        }
      })
      styles.forEach((style) => {
        if (style.text) {
          const inlineStyleReference = notifyInlineAssetFound({
            specifier: getUniqueNameForInlineHtmlNode(
              style,
              styles,
              `${urlToBasename(htmlUrl)}.[id].css`,
            ),
            ...getHtmlNodeLocation(style.node),
            source: style.text,
          })
          htmlMutationMap.set(inlineStyleReference, ({ sourceAfterTransformation }) => {
            replaceHtmlNode(style.node, `<style>${sourceAfterTransformation}</style>`)
          })
        }
      })

      return async (dependenciesMapping) => {
        htmlMutationMap.forEach((mutationCallback, reference) => {
          const urlRelativeToImporter = dependenciesMapping[reference.target.url]
          mutationCallback({
            urlRelativeToImporter,
            sourceAfterTransformation: reference.target.sourceAfterTransformation,
          })
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

      const urlNodeReferenceMapping = new Map()
      atImports.forEach((atImport) => {
        const cssImportReference = notifyAssetFound({
          specifier: atImport.specifier,
          line: atImport.urlDeclarationNode.source.start.line,
          column: atImport.urlDeclarationNode.source.start.column,
        })
        urlNodeReferenceMapping.set(atImport.urlNode, cssImportReference)
      })
      urlDeclarations.forEach((urlDeclaration) => {
        const cssAssetReference = notifyAssetFound({
          specifier: urlDeclaration.specifier,
          line: urlDeclaration.urlDeclarationNode.source.start.line,
          column: urlDeclaration.urlDeclarationNode.source.start.column,
        })
        urlNodeReferenceMapping.set(urlDeclaration.urlNode, cssAssetReference)
      })

      return async (dependenciesMapping, { precomputeFileNameForRollup, registerAssetEmitter }) => {
        const cssReplaceResult = await replaceCssUrls(cssSource, cssUrl, ({ urlNode }) => {
          const urlNodeFound = Array.from(urlNodeReferenceMapping.keys()).find((urlNodeCandidate) =>
            isSameCssDocumentUrlNode(urlNodeCandidate, urlNode),
          )
          if (!urlNodeFound) {
            return urlNode.value
          }
          // url node nous dit quel réfrence y correspond
          const urlNodeReference = urlNodeReferenceMapping.get(urlNodeFound)
          return dependenciesMapping[urlNodeReference.target.url]
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

    if (url.endsWith(".importmap")) {
      const importmapSource = String(source)
      return () => {
        // this is to remove eventual whitespaces
        return JSON.stringify(JSON.parse(importmapSource))
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

const getUniqueNameForInlineHtmlNode = (node, nodes, pattern) => {
  return renderNamePattern(pattern, {
    id: () => {
      const nodeId = node.attributes.id
      if (nodeId) {
        return nodeId
      }

      const { line, column } = getHtmlNodeLocation(node.node)
      const lineTaken = nodes.some(
        (nodeCandidate) =>
          nodeCandidate !== node && getHtmlNodeLocation(nodeCandidate.node).line === line,
      )
      if (lineTaken) {
        return `${line}.${column}`
      }

      return line
    },
  })
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
