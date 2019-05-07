import { stringToStringWithLink } from "../../stringToStringWithLink.js"
import { rejectionValueToMeta } from "./rejectionValueToMeta.js"

export const displayErrorInDocument = (error) => {
  const meta = rejectionValueToMeta(error)
  const theme = meta.dataTheme || "dark"
  const hasImportInfo = meta.href && meta.importerHref
  const hasHrefInfo = meta.href && !meta.importerHref

  // eslint-disable-next-line no-nested-ternary
  const title = hasImportInfo
    ? createHTMLForErrorWithImportInfo({
        href: meta.href,
        importerHref: meta.importerHref,
      })
    : hasHrefInfo
    ? createHTMLForErrorWithHrefInfo({
        href: meta.href,
      })
    : createHTMLForError()

  let message = errorToHTML(meta.error)

  message = message.replace(/\n/g, "\n")

  const css = `
    .jsenv-console pre {
      overflow: auto;
      /* avoid scrollbar to hide the text behind it */
      padding-top: 20px;
      padding-right: 20px;
      padding-bottom: 20px;
    }

    .jsenv-console pre[data-theme="dark"] {
      background: transparent;
      border: 1px solid black
    }

    .jsenv-console pre[data-theme="light"] {
      background: #1E1E1E;
      border: 1px solid white;
      color: #EEEEEE;
    }

    .jsenv-console pre[data-theme="light"] a {
      color: inherit;
    }
    `

  // it could be a sort of dialog on top of document with
  // a slight opacity
  // or it should replace what is inside the document.
  // To know what to do we must test with some code having UI
  // and ensure error are still visible
  const html = `
      <style type="text/css">${css}></style>
      <div class="jsenv-console">
        <h1>${title}</h1>
        <pre data-theme="${theme}">${message}</pre>
      </div>
      `
  appendHMTLInside(html, document.body)
}

const createHTMLForErrorWithImportInfo = ({
  href,
  importerHref,
}) => `error with imported module.<br />
href: ${convertHrefToLink({ href })}
imported by: ${convertHrefToLink({ href: importerHref })}`

const createHTMLForErrorWithHrefInfo = ({ href }) => `error with module.<br/>
href: ${convertHrefToLink({ href })}`

const createHTMLForError = () => `error during execution.`

const convertHrefToLink = ({ href }) => `<a href="${href}">${href}</a>`

const errorToHTML = (error) => {
  let html

  if (error && error instanceof Error) {
    html = error.stack
  } else if (typeof error === "string") {
    html = error
  } else {
    html = JSON.stringify(error)
  }

  return stringToStringWithLink(html, {
    transform: (href) => {
      return { href, text: href }
    },
  })
}

const appendHMTLInside = (html, parentNode) => {
  const temoraryParent = document.createElement("div")
  temoraryParent.innerHTML = html
  transferChildren(temoraryParent, parentNode)
}

const transferChildren = (fromNode, toNode) => {
  while (fromNode.firstChild) {
    toNode.appendChild(fromNode.firstChild)
  }
}
