/**

- https://github.com/systemjs/systemjs/blob/d37f7cade33bb965ccfbd8e1a065e7c5db80a800/src/features/script-load.js#L61

TODO:

inline javascript should create an external file (the name would be hash of script content)
that external file should also be compiled (babel transformed)
and that would be outputed as an html asset

*/

import { require } from "../require.js"

const parse5 = require("parse5")

export const compileHtml = async (htmlBeforeCompilation, { headScripts = [] } = {}) => {
  // https://github.com/inikulin/parse5/blob/master/packages/parse5/docs/tree-adapter/interface.md
  const document = parse5.parse(htmlBeforeCompilation)
  injectHeadScripts(document, headScripts)
  polyfillModuleScripts(document)
  const htmlAfterCompilation = parse5.serialize(document)
  return {
    htmlAfterCompilation,
  }
}

const injectHeadScripts = (document, headScripts) => {
  const headScriptHtml = headScripts.reduce((previous, script) => {
    const scriptAttributes = objectToHtmlAttributes(script)
    return `${previous}<script ${scriptAttributes}></script>
      `
  }, "")
  const fragment = parse5.parseFragment(headScriptHtml)

  const htmlNode = document.childNodes[0]
  const headNode = htmlNode.childNodes[0]
  const headChildNodes = headNode.childNodes
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

const polyfillModuleScripts = (document) => {
  visitDocument(document, (node) => {
    if (node.nodeName !== "script") {
      return
    }

    const attributes = node.attrs
    const typeAttributeIndex = attributes.findIndex((attr) => attr.name === "type")
    if (typeAttributeIndex === -1) {
      return
    }

    const typeAttribute = attributes[typeAttributeIndex]
    const typeAttributeValue = typeAttribute.value
    if (typeAttributeValue !== "module") {
      return
    }

    const srcAttributeIndex = attributes.findIndex((attr) => attr.name === "src")
    if (srcAttributeIndex > -1) {
      const srcAttribute = attributes[srcAttributeIndex]
      const srcAttributeValue = srcAttribute.value

      const script = parseHtmlAsSingleElement(
        `<script>
      window.__jsenv__.importFile(${JSON.stringify(srcAttributeValue)})
    </script>`,
      )
      // inherit script attributes (except src and type)
      script.attrs = [
        ...script.attrs,
        ...attributes.filter((attr) => attr.name !== "type" && attr.name !== "src"),
      ]
      replaceNode(node, script)
      return
    }

    const firstChild = node.childNodes[0]
    if (firstChild && firstChild.nodeName === "#text") {
      const scriptText = firstChild.value
      const script = parseHtmlAsSingleElement(`<script>
  alert(${JSON.stringify(scriptText)})
</script>`)
      // inherit script attributes (except src and type)
      script.attrs = [
        ...script.attrs,
        ...attributes.filter((attr) => attr.name !== "type" && attr.name !== "src"),
      ]
      replaceNode(node, script)
      return
    }
  })
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
