/**

An important concern here:

All script type="module" will be converted to inline script.
These inline script execution order is non predictible it depends
which one is being done first

*/

import { createHash } from "crypto"
import { require } from "../require.js"

const parse5 = require("parse5")

export const compileHtml = (
  htmlBeforeCompilation,
  {
    scriptManipulations = [],
    importmapSrc,
    importmapType,
    replaceModuleScripts = true,
    // resolveScriptSrc = (src) => src,
    generateInlineScriptSrc = ({ hash }) => `./${hash}.js`,
    generateInlineScriptCode = ({ src }) => `<script>
  window.__jsenv__.importFile(${JSON.stringify(src)})
</script>`,
  } = {},
) => {
  // https://github.com/inikulin/parse5/blob/master/packages/parse5/docs/tree-adapter/interface.md
  const document = parse5.parse(htmlBeforeCompilation)

  if (importmapSrc) {
    scriptManipulations = [
      ...scriptManipulations,
      {
        // when html file already contains an importmap script tag
        // its src is replaced to target the importmap used for compiled files
        replaceExisting: true,
        type: "importmap",
        src: importmapSrc,
      },
    ]
  }

  manipulateScripts(document, scriptManipulations)

  const { inlineScriptTanspiled, remoteScriptTranspiled } = polyfillScripts(document, {
    replaceModuleScripts,
    importmapType,
    generateInlineScriptSrc,
    generateInlineScriptCode,
  })
  // resolveScripts(document, resolveScriptSrc)

  const htmlAfterCompilation = parse5.serialize(document)
  return {
    htmlAfterCompilation,
    inlineScriptTanspiled,
    remoteScriptTranspiled,
  }
}

const manipulateScripts = (document, scriptManipulations) => {
  const htmlNode = document.childNodes.find((node) => node.nodeName === "html")
  const headNode = htmlNode.childNodes[0]
  const bodyNode = htmlNode.childNodes[1]

  const scriptsToPreprendInHead = []

  scriptManipulations.forEach(({ replaceExisting = false, ...script }) => {
    const scriptExistingInHead = findExistingScript(headNode, script)
    if (scriptExistingInHead) {
      if (replaceExisting) {
        replaceNode(scriptExistingInHead, scriptToNode(script))
      }
      return
    }

    const scriptExistingInBody = findExistingScript(bodyNode, script)
    if (scriptExistingInBody) {
      if (replaceExisting) {
        replaceNode(scriptExistingInBody, scriptToNode(script))
      }
      return
    }

    scriptsToPreprendInHead.push(script)
  })

  const headScriptsFragment = scriptsToFragment(scriptsToPreprendInHead)
  insertFragmentBefore(
    headNode,
    headScriptsFragment,
    findChild(headNode, (node) => node.nodeName === "script"),
  )
}

const insertFragmentBefore = (node, fragment, childNode) => {
  const { childNodes = [] } = node

  if (childNode) {
    const childNodeIndex = childNodes.indexOf(childNode)
    node.childNodes = [
      ...childNodes.slice(0, childNodeIndex),
      ...fragment.childNodes.map((child) => {
        return { ...child, parentNode: node }
      }),
      ...childNodes.slice(childNodeIndex),
    ]
  } else {
    node.childNodes = [
      ...childNodes,
      ...fragment.childNodes.map((child) => {
        return { ...child, parentNode: node }
      }),
    ]
  }
}

const scriptToNode = (script) => {
  return scriptsToFragment([script]).childNodes[0]
}

const scriptsToFragment = (scripts) => {
  const html = scripts.reduce((previous, script) => {
    const scriptAttributes = objectToHtmlAttributes(script)
    return `${previous}<script ${scriptAttributes}></script>
      `
  }, "")
  const fragment = parse5.parseFragment(html)
  return fragment
}

const findExistingScript = (node, script) =>
  findChild(node, (childNode) => {
    return childNode.nodeName === "script" && sameScript(childNode, script)
  })

const findChild = ({ childNodes = [] }, predicate) => childNodes.find(predicate)

const sameScript = (node, { type = "text/javascript", src }) => {
  const nodeType = getAttributeValue(node, "type") || "text/javascript"
  const nodeSrc = getAttributeValue(node, "src")

  if (type === "importmap") {
    return nodeType === type
  }

  return nodeType === type && nodeSrc === src
}

const objectToHtmlAttributes = (object) => {
  return Object.keys(object)
    .map((key) => `${key}=${valueToHtmlAttributeValue(object[key])}`)
    .join(" ")
}

const valueToHtmlAttributeValue = (value) => {
  if (typeof value === "string") {
    return JSON.stringify(value)
  }
  return `"${JSON.stringify(value)}"`
}

const polyfillScripts = (
  document,
  { replaceModuleScripts, importmapType, generateInlineScriptSrc, generateInlineScriptCode },
) => {
  /*
  <script type="module" src="*" /> are going to be inlined
  <script type="module">** </script> are going to be transformed to import a file so that we can transform the script content.

  but we don't want that a script with an src to be considered as an inline script after it was inlined.

  For that reason we perform mutation in the end
  */
  const mutations = []
  const inlineScriptTanspiled = {}
  const remoteScriptTranspiled = {}

  visitDocument(document, (node) => {
    if (node.nodeName !== "script") {
      return
    }

    const attributes = node.attrs
    const nodeType = getAttributeValue(node, "type")

    if (replaceModuleScripts && nodeType === "module") {
      const nodeSrc = getAttributeValue(node, "src")
      if (nodeSrc) {
        mutations.push(() => {
          const script = parseHtmlAsSingleElement(generateInlineScriptCode({ src: nodeSrc }))
          const { attrs = [] } = script
          // inherit script attributes (except src and type)
          script.attrs = [
            ...attrs,
            ...attributes.filter((attr) => attr.name !== "type" && attr.name !== "src"),
          ]
          replaceNode(node, script)

          inlineScriptTanspiled[nodeSrc] = true
        })
        return
      }

      const firstChild = node.childNodes[0]
      if (firstChild && firstChild.nodeName === "#text") {
        const scriptText = firstChild.value
        mutations.push(() => {
          const nodeId = getAttributeValue(node, "id")
          const hash = createScriptContentHash(scriptText)
          const src = generateInlineScriptSrc({
            id: nodeId,
            hash,
          })
          const script = parseHtmlAsSingleElement(generateInlineScriptCode({ src }))
          const { attrs = [] } = script
          // inherit script attributes (except src and type)
          script.attrs = [
            ...attrs,
            ...attributes.filter((attr) => attr.name !== "type" && attr.name !== "src"),
          ]
          replaceNode(node, script)

          remoteScriptTranspiled[src] = scriptText
        })
        return
      }
    }

    if (importmapType && nodeType === "importmap") {
      const typeAttribute = getAttributeByName(node.attrs, "type")
      typeAttribute.value = importmapType
    }
  })

  mutations.forEach((fn) => fn())

  return { inlineScriptTanspiled, remoteScriptTranspiled }
}

// const resolveScripts = (document, resolveScriptSrc) => {
//   visitDocument(document, (node) => {
//     if (node.nodeName !== "script") {
//       return
//     }

//     const attributes = node.attrs
//     const srcAttribute = getAttributeByName(attributes, "src")
//     if (!srcAttribute) {
//       return
//     }

//     const srcAttributeValue = srcAttribute.value
//     srcAttribute.value = resolveScriptSrc(srcAttributeValue)
//   })
// }

const getAttributeValue = (node, attributeName) => {
  const attribute = getAttributeByName(node.attrs, attributeName)
  return attribute ? attribute.value : undefined
}

const getAttributeByName = (attributes, attributeName) =>
  attributes.find((attr) => attr.name === attributeName)

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
