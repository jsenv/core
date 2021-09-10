/**

https://github.com/postcss/postcss/blob/master/docs/writing-a-plugin.md
https://github.com/postcss/postcss/blob/master/docs/guidelines/plugin.md
https://github.com/postcss/postcss/blob/master/docs/guidelines/runner.md#31-dont-show-js-stack-for-csssyntaxerror

In case css sourcemap contains no%20source
This is because of https://github.com/postcss/postcss/blob/fd30d3df5abc0954a0ec642a3cdc644ab2aacf9c/lib/map-generator.js#L231
and it indicates a node has been replaced without passing source
hence sourcemap cannot point the original source location

*/

import { fileSystemPathToUrl, resolveUrl } from "@jsenv/filesystem"
import { require } from "@jsenv/core/src/internal/require.js"

export const postCssUrlHashPlugin = () => {
  const parseCssValue = require("postcss-value-parser")
  const stringifyCssNodes = parseCssValue.stringify

  return {
    postcssPlugin: "urlhash",
    prepare: (result) => {
      const {
        from,
        collectUrls = false,
        getUrlReplacementValue = () => undefined,
      } = result.opts
      const fromUrl = fileSystemPathToUrl(from)
      return {
        AtRule: {
          import: (atImportNode, { AtRule }) => {
            if (atImportNode.parent.type !== "root") {
              atImportNode.warn(result, "`@import` should be top level")
              return
            }

            if (atImportNode.nodes) {
              atImportNode.warn(
                result,
                "`@import` was not terminated correctly",
              )
              return
            }

            const parsed = parseCssValue(atImportNode.params)
            let [urlNode] = parsed.nodes

            if (
              !urlNode ||
              (urlNode.type !== "string" && urlNode.type !== "function")
            ) {
              atImportNode.warn(
                result,
                `No URL in \`${atImportNode.toString()}\``,
              )
              return
            }

            let url = ""
            if (urlNode.type === "string") {
              url = urlNode.value
            } else if (urlNode.type === "function") {
              // Invalid function
              if (!/^url$/i.test(urlNode.value)) {
                atImportNode.warn(
                  result,
                  `Invalid \`url\` function in \`${atImportNode.toString()}\``,
                )
                return
              }

              const firstNode = urlNode.nodes[0]
              if (firstNode && firstNode.type === "string") {
                urlNode = firstNode
                url = urlNode.value
              } else {
                urlNode = urlNode.nodes
                url = stringifyCssNodes(urlNode.nodes)
              }
            }

            url = url.trim()

            if (url.length === 0) {
              atImportNode.warn(
                result,
                `Empty URL in \`${atImportNode.toString()}\``,
              )
              return
            }

            const specifier = url
            url = resolveUrl(specifier, fromUrl)

            if (url === fromUrl) {
              atImportNode.warn(
                result,
                `\`@import\` loop in \`${atImportNode.toString()}\``,
              )
              return
            }

            const urlReference = {
              type: "import",
              specifier,
              url,
              atImportNode,
              urlNode,
            }
            const urlNewValue = getUrlReplacementValue(urlReference)
            if (urlNewValue && urlNewValue !== urlNode.value) {
              urlNode.value = urlNewValue
              const newParams = parsed.toString()
              const newAtImportRule = new AtRule({
                name: "import",
                params: newParams,
                source: atImportNode.source,
              })
              atImportNode.replaceWith(newAtImportRule)
            }

            if (collectUrls) {
              result.messages.push(urlReference)
            }
          },
        },
        Declaration: (declarationNode) => {
          if (!declarationNodeContainsUrl(declarationNode)) {
            return
          }

          walkUrls(declarationNode, {
            parseCssValue,
            stringifyCssNodes,
            visitor: (url, urlNode) => {
              // Empty URL
              if (!urlNode || url.length === 0) {
                declarationNode.warn(
                  result,
                  `Empty URL in \`${declarationNode.toString()}\``,
                )
                return
              }

              // Skip Data URI
              if (isDataUrl(url)) {
                return
              }

              const specifier = url
              url = resolveUrl(specifier, fileSystemPathToUrl(from))

              const urlReference = {
                type: "asset",
                specifier,
                url,
                declarationNode,
                urlNode,
              }

              const urlNewValue = getUrlReplacementValue(urlReference)
              if (urlNewValue) {
                urlNode.value = urlNewValue
              }

              if (collectUrls) {
                result.messages.push(urlReference)
              }
            },
          })
        },
      }
    },
  }
}
postCssUrlHashPlugin.postcss = true

const declarationNodeContainsUrl = (declarationNode) => {
  return /^(?:url|(?:-webkit-)?image-set)\(/i.test(declarationNode.value)
}

const walkUrls = (
  declarationNode,
  { parseCssValue, stringifyCssNodes, visitor },
) => {
  const parsed = parseCssValue(declarationNode.value)
  parsed.walk((node) => {
    // https://github.com/andyjansson/postcss-functions
    if (isUrlFunctionNode(node)) {
      const { nodes } = node
      const [urlNode] = nodes
      const url =
        urlNode && urlNode.type === "string"
          ? urlNode.value
          : stringifyCssNodes(nodes)
      visitor(url.trim(), urlNode)
      return
    }

    if (isImageSetFunctionNode(node)) {
      Array.from(node.nodes).forEach((childNode) => {
        if (childNode.type === "string") {
          visitor(childNode.value.trim(), childNode)
          return
        }

        if (isUrlFunctionNode(node)) {
          const { nodes } = childNode
          const [urlNode] = nodes
          const url =
            urlNode && urlNode.type === "string"
              ? urlNode.value
              : stringifyCssNodes(nodes)
          visitor(url.trim(), urlNode)
          return
        }
      })
    }
  })

  declarationNode.value = parsed.toString()
}

const isUrlFunctionNode = (node) => {
  return node.type === "function" && /^url$/i.test(node.value)
}

const isImageSetFunctionNode = (node) => {
  return (
    node.type === "function" && /^(?:-webkit-)?image-set$/i.test(node.value)
  )
}

const isDataUrl = (url) => {
  return /data:[^\n\r;]+?(?:;charset=[^\n\r;]+?)?;base64,([\d+/A-Za-z]+={0,2})/.test(
    url,
  )
}
