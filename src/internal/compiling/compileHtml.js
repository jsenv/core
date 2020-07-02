/**

*/

import { createHash } from "crypto"
import { require } from "../require.js"

const parse5 = require("parse5")

export const compileHtml = (
  htmlBeforeCompilation,
  { headScripts = [], generateInlineScriptSrc = ({ hash }) => `./${hash}.js` } = {},
) => {
  // https://github.com/inikulin/parse5/blob/master/packages/parse5/docs/tree-adapter/interface.md
  const document = parse5.parse(htmlBeforeCompilation)
  injectHeadScripts(document, headScripts)
  const scriptsExternalized = polyfillModuleScripts(document, { generateInlineScriptSrc })
  const htmlAfterCompilation = parse5.serialize(document)
  return {
    htmlAfterCompilation,
    scriptsExternalized,
  }
}

const injectHeadScripts = (document, headScripts) => {
  const htmlNode = document.childNodes.find((node) => node.nodeName === "html")
  const headNode = htmlNode.childNodes[0]
  const headChildNodes = headNode.childNodes

  const headScriptsToInject = headScripts.filter((script) => {
    return !headChildNodes.some((node) => {
      if (node.nodeName !== "script") return false
      const srcAttribute = getAttributeByName(node.attrs, "src")
      if (!srcAttribute) return false
      return srcAttribute.value === script.src
    })
  })

  const headScriptHtml = headScriptsToInject.reduce((previous, script) => {
    const scriptAttributes = objectToHtmlAttributes(script)
    return `${previous}<script ${scriptAttributes}></script>
      `
  }, "")
  const fragment = parse5.parseFragment(headScriptHtml)

  const firstScriptChildIndex = headChildNodes.findIndex((node) => node.nodeName === "script")
  if (firstScriptChildIndex > -1) {
    headNode.childNodes = [
      ...headChildNodes.slice(0, firstScriptChildIndex),
      ...fragment.childNodes,
      ...headChildNodes.slice(firstScriptChildIndex),
    ]
  } else {
    // prefer append (so that any first child being text remains and indentation is safe)
    headNode.childNodes = [...headChildNodes, ...fragment.childNodes]
  }
}

const objectToHtmlAttributes = (object) => {
  return Object.keys(object)
    .map((key) => `${key}=${JSON.stringify(object[key])}`)
    .join(" ")
}

const polyfillModuleScripts = (document, { generateInlineScriptSrc }) => {
  /*
  <script type="module" src="*" /> are going to be inlined
  <script type="module">** </script> are going to be transformed to import a file so that we can transform the script content.

  but we don't want that a script with an src to be considered as an inline script after it was inlined.

  For that reason we perform mutation in the end
  */
  const mutations = []
  const scriptsExternalized = {}

  visitDocument(document, (node) => {
    if (node.nodeName !== "script") {
      return
    }

    const attributes = node.attrs
    const typeAttribute = getAttributeByName(attributes, "type")
    if (!typeAttribute) {
      return
    }

    const typeAttributeValue = typeAttribute.value
    if (typeAttributeValue !== "module") {
      return
    }

    const srcAttribute = getAttributeByName(attributes, "src")
    if (srcAttribute) {
      const srcAttributeValue = srcAttribute.value

      mutations.push(() => {
        const script = parseHtmlAsSingleElement(generateScriptForJsenv(srcAttributeValue))
        // inherit script attributes (except src and type)
        script.attrs = [
          ...script.attrs,
          ...attributes.filter((attr) => attr.name !== "type" && attr.name !== "src"),
        ]
        replaceNode(node, script)
      })
      return
    }

    const firstChild = node.childNodes[0]
    if (firstChild && firstChild.nodeName === "#text") {
      const scriptText = firstChild.value
      mutations.push(() => {
        const hash = createScriptContentHash(scriptText)
        const src = generateInlineScriptSrc({ hash })
        const script = parseHtmlAsSingleElement(generateScriptForJsenv(src))
        // inherit script attributes (except src and type)
        script.attrs = [
          ...script.attrs,
          ...attributes.filter((attr) => attr.name !== "type" && attr.name !== "src"),
        ]
        replaceNode(node, script)

        scriptsExternalized[src] = scriptText
      })
      return
    }
  })

  mutations.forEach((fn) => fn())

  return scriptsExternalized
}

const getAttributeByName = (attributes, attributeName) =>
  attributes.find((attr) => attr.name === attributeName)

const generateScriptForJsenv = (src) => {
  return `<script>
      window.__jsenv__.importFile(${JSON.stringify(src)})
    </script>`
}

const createScriptContentHash = (content) => {
  const hash = createHash("sha256")
  hash.update(content)
  return hash.digest("hex").slice(0, 8)
}

const parseHtmlAsSingleElement = (html) => {
  const fragment = parse5.parseFragment(html)
  return fragment.childNodes[0]
}

const replaceNode = (node, newNode) => {
  const { parentNode } = node
  const parentNodeChildNodes = parentNode.childNodes
  const nodeIndex = parentNodeChildNodes.indexOf(node)
  parentNodeChildNodes[nodeIndex] = newNode
}

const visitDocument = (document, fn) => {
  const visitNode = (node) => {
    fn(node)
    const { childNodes } = node
    if (childNodes) {
      let i = 0
      while (i < childNodes.length) {
        visitNode(childNodes[i++])
      }
    }
  }
  visitNode(document)
}
