export const displayErrorInDocument = (error) => {
  const title = "An error occured"
  let theme
  let message

  if (error && error.parsingError) {
    theme = "light"
    const { parsingError } = error
    message = errorToHTML(parsingError.messageHTML || escapeHtml(parsingError.message))
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
      border: 1px solid black;
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

const escapeHtml = (string) => {
  return string
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

const errorToHTML = (error) => {
  let html

  if (error && error instanceof Error) {
    //  stackTrace formatted by V8
    if (Error.captureStackTrace) {
      html = escapeHtml(error.stack)
    } else {
      // other stack trace such as firefox do not contain error.message
      html = escapeHtml(`${error.message}
  ${error.stack}`)
    }
  } else if (typeof error === "string") {
    html = error
  } else {
    html = JSON.stringify(error)
  }

  const htmlWithCorrectLineBreaks = html.replace(/\n/g, "\n")
  const htmlWithLinks = stringToStringWithLink(htmlWithCorrectLineBreaks, {
    transform: (url) => {
      return { href: url, text: url }
    },
  })
  return htmlWithLinks
}

// `Error: yo
// at Object.execute (http://127.0.0.1:57300/build/src/__test__/file-throw.js:9:13)
// at doExec (http://127.0.0.1:3000/src/__test__/file-throw.js:452:38)
// at postOrderExec (http://127.0.0.1:3000/src/__test__/file-throw.js:448:16)
// at http://127.0.0.1:3000/src/__test__/file-throw.js:399:18`.replace(/(?:https?|ftp|file):\/\/(.*+)$/gm, (...args) => {
//   debugger
// })
const stringToStringWithLink = (
  source,
  {
    transform = (url) => {
      return {
        href: url,
        text: url,
      }
    },
  } = {},
) => {
  return source.replace(/(?:https?|ftp|file):\/\/\S+/gm, (match) => {
    let linkHTML = ""

    const lastChar = match[match.length - 1]

    // hotfix because our url regex sucks a bit
    const endsWithSeparationChar = lastChar === ")" || lastChar === ":"
    if (endsWithSeparationChar) {
      match = match.slice(0, -1)
    }

    const lineAndColumnPattern = /:([0-9]+):([0-9]+)$/
    const lineAndColumMatch = match.match(lineAndColumnPattern)
    if (lineAndColumMatch) {
      const lineAndColumnString = lineAndColumMatch[0]
      const lineNumber = lineAndColumMatch[1]
      const columnNumber = lineAndColumMatch[2]
      const url = match.slice(0, -lineAndColumnString.length)
      const { href, text } = transform(url)
      linkHTML = link({ href, text: `${text}:${lineNumber}:${columnNumber}` })
    } else {
      const linePattern = /:([0-9]+)$/
      const lineMatch = match.match(linePattern)
      if (lineMatch) {
        const lineString = lineMatch[0]
        const lineNumber = lineMatch[1]
        const url = match.slice(0, -lineString.length)
        const { href, text } = transform(url)
        linkHTML = link({
          href,
          text: `${text}:${lineNumber}`,
        })
      } else {
        const url = match
        const { href, text } = transform(url)
        linkHTML = link({ href, text })
      }
    }

    if (endsWithSeparationChar) {
      return `${linkHTML}${lastChar}`
    }
    return linkHTML
  })
}

const link = ({ href, text = href }) => `<a href="${href}">${text}</a>`

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
