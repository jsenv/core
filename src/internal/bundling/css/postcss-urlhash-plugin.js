// import postcss from "postcss"
import valueParser from "postcss-value-parser"

export const postCssUrlHashPlugin = () => {
  return {
    postcssPlugin: "urlhash",
    prepare: (result) => {
      const { urlReplacements } = result.opts
      return {
        AtRule: (atRuleNode) => {
          if (atRuleNode.parent.type !== "root") {
            atRuleNode.warn(result, "`@import` should be top level")
            return
          }

          if (atRuleNode.nodes) {
            atRuleNode.warn(result, "`@import` was not terminated correctly")
            return
          }

          let [urlNode] = valueParser(atRuleNode.params).nodes

          if (!urlNode || (urlNode.type !== "string" && urlNode.type !== "function")) {
            atRuleNode.warn(result, `No URL in \`${atRuleNode.toString()}\``)
            return
          }

          let url = ""
          if (urlNode.type === "string") {
            url = urlNode.value
          } else if (urlNode.type === "function") {
            // Invalid function
            if (!/^url$/i.test(urlNode.value)) {
              atRuleNode.warn(result, `Invalid \`url\` function in \`${atRuleNode.toString()}\``)
              return
            }

            const firstNode = urlNode.nodes[0]
            if (firstNode && firstNode.type === "string") {
              urlNode = firstNode
              url = urlNode.value
            } else {
              urlNode = urlNode.nodes
              url = valueParser.stringify(urlNode.nodes)
            }
          }

          url = url.trim()

          if (url.length === 0) {
            atRuleNode.warn(result, `Empty URL in \`${atRuleNode.toString()}\``)
            return
          }

          result.messages.push({
            type: "import",
            url,
            atRuleNode,
            urlNode,
          })
        },
        Declaration: (declarationNode) => {
          if (!declarationNodeContainsUrl(declarationNode)) {
            return
          }

          walkUrls(declarationNode, (url, urlNode) => {
            // Empty URL
            if (!urlNode || url.length === 0) {
              declarationNode.warn(result, `Empty URL in \`${declarationNode.toString()}\``)
              return
            }

            // Skip Data URI
            if (isDataUrl(url)) {
              return
            }

            result.messages.push({
              type: "asset",
              url,
              declarationNode,
              urlNode,
            })
          })
        },
      }
    },
  }
}
postCssAssetPlugin.postcss = true

const declarationNodeContainsUrl = (declarationNode) => {
  return /^(?:url|(?:-webkit-)?image-set)\(/i.test(declarationNode.value)
}

const walkUrls = (declarationNode, callback) => {
  const parsed = valueParser(declarationNode.value)
  parsed.walk((node) => {
    if (isUrlFunctionNode(node)) {
      const { nodes } = node
      const [urlNode] = nodes
      const url =
        urlNode && urlNode.type === "string" ? urlNode.value : valueParser.stringify(nodes)
      callback(url.trim(), urlNode)
      return
    }

    if (isImageSetFunctionNode(node)) {
      Array.from(node.nodes).forEach((childNode) => {
        if (childNode.type === "string") {
          callback(childNode.value.replace(/^\s+|\s+$/g, ""), childNode)
          return
        }

        if (isUrlFunctionNode(node)) {
          const { nodes } = childNode
          const [urlNode] = nodes
          const url =
            urlNode && urlNode.type === "string" ? urlNode.value : valueParser.stringify(nodes)
          callback(url.trim(), urlNode)
          return
        }
      })
    }
  })
}

const isUrlFunctionNode = (node) => {
  return node.type === "function" && /^url$/i.test(node.value)
}

const isImageSetFunctionNode = (node) => {
  return node.type === "function" && /^(?:-webkit-)?image-set$/i.test(node.value)
}

const isDataUrl = (url) => {
  return /data:[^\n\r;]+?(?:;charset=[^\n\r;]+?)?;base64,([\d+/A-Za-z]+={0,2})/.test(url)
}
