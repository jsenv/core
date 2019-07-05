import { stringToStringWithLink } from "../../stringToStringWithLink.js"

export const displayErrorInDocument = (error) => {
  const title = "An error occured"
  let theme
  let message

  if (error && error.code === "MODULE_PARSING_ERROR") {
    theme = "light"
    const { parsingError } = error
    message = errorToHTML(parsingError.messageHMTL || parsingError.message)
  } else {
    theme = "dark"
    message = errorToHTML(error)
  }

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

const errorToHTML = (error) => {
  let html

  if (error && error instanceof Error) {
    html = error.stack
  } else if (typeof error === "string") {
    html = error
  } else {
    html = JSON.stringify(error)
  }

  const htmlWithCorrectLineBreaks = html.replace(/\n/g, "\n")
  const htmlWithLinks = stringToStringWithLink(htmlWithCorrectLineBreaks, {
    transform: (href) => {
      return { href, text: href }
    },
  })
  return htmlWithLinks
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
