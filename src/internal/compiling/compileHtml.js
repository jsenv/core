/**

An important concern here:

All script type="module" will be converted to inline script.
These inline script execution order is non predictible it depends
which one is being done first

*/

import { createHash } from "crypto"
import { require } from "../require.js"

const parse5 = require("parse5")

export const parseHtmlString = (htmlString) => {
  return parse5.parse(htmlString)
}

export const stringifyHtmlDocument = (htmlDocument) => {
  return parse5.serialize(htmlDocument)
}

// let's <img>, <link for favicon>, <link for css>, <styles>
// <audio> <video> <picture> supports comes for free by detecting
// <source src> attribute
// if srcset is used we should parse it and collect all src referenced in it
// also <link ref="preload">
// ideally relative iframe should recursively fetch (not needed so lets ignore)
// <svg> ideally looks for external ressources inside them

// but right now we will focus on: <link href> and <style> tags
// on veut vérifier qu'on les récupere bien
// dans rollup pour chaque css on feras le transformcss + l'ajout des assets reférencés
// pour le style inline on le parse aussi et on le remettra inline dans le html
// ensuite qu'on est capable de les mettre a jour
// ce qui veut dire de mettre a jour link.ref et style.text
export const parseHtmlDocumentRessources = (document) => {
  const scripts = []
  const styles = []

  visitDocument(document, (node) => {
    if (node.nodeName === "script") {
      const attributes = attributeArrayToAttributeObject(node.attrs)
      const firstChild = node.childNodes[0]
      scripts.push({
        node,
        attributes,
        ...(firstChild && firstChild.nodeName === "#text" ? { text: firstChild.value } : {}),
      })
    }
    if (node.nodeName === "link") {
      const attributes = attributeArrayToAttributeObject(node.attrs)
      if (attributes.rel === "stylesheet") {
        styles.push({
          node,
          attributes,
        })
      }
    }
    if (node.nameName === "style") {
      const attributes = attributeArrayToAttributeObject(node.attrs)
      const firstChild = node.childNodes[0]
      styles.push({
        node,
        attributes,
        ...(firstChild && firstChild.nodeName === "#text" ? { text: firstChild.value } : {}),
      })
    }
  })

  return {
    scripts,
    styles,
  }
}

const attributeArrayToAttributeObject = (attributes) => {
  const attributeObject = {}
  attributes.forEach((attribute) => {
    attributeObject[attribute.name] = attribute.value
  })
  return attributeObject
}

const attributesObjectToAttributesArray = (attributeObject) => {
  const attributeArray = []
  Object.keys(attributeObject).forEach((key) => {
    attributeArray.push({ name: key, value: attributeObject[key] })
  })
  return attributeArray
}

export const transformHtmlDocumentModuleScripts = (
  scripts,
  {
    generateInlineScriptCode = ({ src }) => `<script>
      window.__jsenv__.importFile(${JSON.stringify(src)})
    </script>`,
    generateInlineScriptSrc = ({ hash }) => `./${hash}.js`,
  },
) => {
  /*
  <script type="module" src="*" /> are going to be inlined
  <script type="module">**</script> are going to be transformed to import a file so that we can transform the script content.

  but we don't want that a script with an src to be considered as an inline script after it was inlined.

  For that reason we perform mutation in the end
  */

  const remoteScriptsTransformed = {}
  const inlineScriptsTransformed = {}

  const mutations = scripts.map((script, index) => {
    if (script.attributes.type === "module" && script.attributes.src) {
      return () => {
        const scriptPolyfilledSource = generateInlineScriptCode(
          { src: script.attributes.src },
          index,
        )
        const scriptPolyfilled = parseHtmlAsSingleElement(scriptPolyfilledSource)
        scriptPolyfilled.attrs = [
          // inherit script attributes except src and type
          ...attributesObjectToAttributesArray(script.attributes).filter(
            ({ name }) => name !== "type" && name !== "src",
          ),
          ...scriptPolyfilled.attrs,
        ]
        replaceNode(script.node, scriptPolyfilled)
        remoteScriptsTransformed[script.attributes.src] = true
      }
    }

    if (script.attributes.type === "module" && script.text) {
      return () => {
        const hash = createScriptContentHash(script.text)
        const src = generateInlineScriptSrc(
          {
            id: script.attributes.id,
            hash,
          },
          index,
        )
        const scriptPolyfilledSource = generateInlineScriptCode({ src }, index)
        const scriptPolyfilled = parseHtmlAsSingleElement(scriptPolyfilledSource)
        scriptPolyfilled.attrs = [
          // inherit script attributes except src and type
          ...attributesObjectToAttributesArray(script.attributes).filter(
            ({ name }) => name !== "type" && name !== "src",
          ),
          ...scriptPolyfilled.attrs,
        ]

        replaceNode(script.node, scriptPolyfilled)
        inlineScriptsTransformed[src] = script.text
      }
    }

    return () => {}
  })

  mutations.forEach((fn) => fn())

  return {
    remoteScriptsTransformed,
    inlineScriptsTransformed,
  }
}

export const transformHtmlDocumentImportmapScript = (scripts, attributes) => {
  scripts.forEach((script) => {
    if (script.attributes.type === "importmap") {
      Object.keys(attributes).forEach((key) => {
        const value = attributes[key]
        if (value !== undefined) {
          const attributeNode = getAttributeByName(script.node.attrs, key)
          attributeNode.value = value
        }
      })
    }
  })
}

export const manipulateHtmlDocument = (document, { scriptInjections = [] }) => {
  const htmlNode = document.childNodes.find((node) => node.nodeName === "html")
  const headNode = htmlNode.childNodes[0]
  const bodyNode = htmlNode.childNodes[1]

  const scriptsToPreprendInHead = []
  scriptInjections.forEach((script) => {
    const scriptExistingInHead = findExistingScript(headNode, script)
    if (scriptExistingInHead) {
      replaceNode(scriptExistingInHead, scriptToNode(script))
      return
    }
    const scriptExistingInBody = findExistingScript(bodyNode, script)
    if (scriptExistingInBody) {
      replaceNode(scriptExistingInBody, scriptToNode(script))
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
    return `${previous}<script ${scriptAttributes}>${script.text || ""}</script>
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

// eslint-disable-next-line no-unused-vars
const objectToHtmlAttributes = ({ text, ...rest }) => {
  return Object.keys(rest)
    .map((key) => `${key}=${valueToHtmlAttributeValue(rest[key])}`)
    .join(" ")
}

const valueToHtmlAttributeValue = (value) => {
  if (typeof value === "string") {
    return JSON.stringify(value)
  }
  return `"${JSON.stringify(value)}"`
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
