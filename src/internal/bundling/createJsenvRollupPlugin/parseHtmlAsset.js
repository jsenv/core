import { urlToBasename, urlToRelativeUrl, resolveUrl, urlToParentUrl } from "@jsenv/util"
import { renderNamePattern } from "./computeFileNameForRollup.js"
import {
  parseHtmlString,
  parseHtmlAstRessources,
  replaceHtmlNode,
  stringifyHtmlAst,
} from "../../compiling/compileHtml.js"

export const parseHtmlAsset = (
  { source, url },
  { notifyAssetFound, notifyInlineAssetFound, notifyJsFound, notifyInlineJsFound },
  { transformHtmlAst = () => {} } = {},
) => {
  const htmlString = String(source)
  const htmlAst = parseHtmlString(htmlString)
  const { scripts, stylesheetLinks, styles } = parseHtmlAstRessources(htmlAst)

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
            `${urlToBasename(url)}.[id].js`,
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
            `${urlToBasename(url)}.[id].importmap`,
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
        specifier: getUniqueNameForInlineHtmlNode(style, styles, `${urlToBasename(url)}.[id].css`),
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
    await transformHtmlAst(htmlAst)
    const htmlAfterTransformation = stringifyHtmlAst(htmlAst)
    // const sourceAfterTransformation = minify ? minifyHtml(htmlTransformedString, minifyHtmlOptions) : htmlAfterTransformation
    return {
      sourceAfterTransformation: htmlAfterTransformation,
    }
  }
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
