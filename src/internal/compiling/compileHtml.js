/**

- https://github.com/systemjs/systemjs/blob/d37f7cade33bb965ccfbd8e1a065e7c5db80a800/src/features/script-load.js#L61

TODO:

what happens if html is badly formatted
what when there is no head tag
be sure it works as babel parse error

enforce a script in html head tag loading jsenv browser system

inline javascript should create an external file (the name would be hash of script content)
that external file should also be compiled (babel transformed)
and that would be outputed as an html asset

*/
import { readFile, urlToRelativeUrl } from "@jsenv/util"
import { require } from "../require.js"

const parse5 = require("parse5")

export const compileHtml = async (originalFileUrl, { compiledFileUrl }) => {
  const htmlBeforeCompilation = await readFile(originalFileUrl)
  // https://github.com/inikulin/parse5/blob/master/packages/parse5/docs/tree-adapter/interface.md
  const document = parse5.parse(htmlBeforeCompilation)

  // il faut aussi absolument que ces scripts charge le fichier pour avoir acces a jsenv.importFile
  // idéalement on insere ça dans la balise head mais le mieux c'est encore que ce soit présent
  // dans le fichier html ?

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

      node.childNodes = [
        {
          nodeName: "#text",
          value: `window.__jsenv__.importFile(${JSON.stringify(srcAttributeValue)})`,
        },
      ]

      // remove src attribute
      attributes.splice(attributes.indexOf(srcAttribute), 1)
      // remove type attribute
      attributes.splice(attributes.indexOf(typeAttribute), 1)
      return
    }

    const firstChild = node.childNodes[0]
    if (firstChild && firstChild.nodeName === "#text") {
      const scriptContent = firstChild.value

      // replace with something that executes the file directly (is it possible with Systemjs?)
      firstChild.value = `alert(${JSON.stringify(scriptContent)})`
      // remove type attribute
      attributes.splice(attributes.indexOf(typeAttribute), 1)
    }
  })

  const htmlAfterCompilation = parse5.serialize(document)
  return {
    compiledSource: htmlAfterCompilation,
    contentType: "text/html",
    sources: [urlToRelativeUrl(originalFileUrl, `${compiledFileUrl}__asset__/meta.json`)],
    sourcesContent: [htmlBeforeCompilation],
    assets: [],
    assetsContent: [],
  }
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
