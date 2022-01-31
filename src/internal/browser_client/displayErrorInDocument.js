/* eslint-env browser */

export const displayErrorInDocument = (error) => {
  const title = "An error occured"
  let theme
  let message

  if (error && error.parsingError) {
    theme = "light"
    const { parsingError } = error
    message = errorToHTML(
      parsingError.messageHTML || escapeHtml(parsingError.message),
    )
  } else {
    theme = "dark"
    message = errorToHTML(error)
  }

  const css = `
    .jsenv-console {
      background: rgba(0, 0, 0, 0.95);
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 1000;
      box-sizing: border-box;
      padding: 1em;
    }

    .jsenv-console h1 {
      color: red;
      display: flex;
      align-items: center;
    }

    #button-close-jsenv-console {
      margin-left: 10px;
    }

    .jsenv-console pre {
      overflow: auto;
      max-width: 70em;
      /* avoid scrollbar to hide the text behind it */
      padding: 20px;
    }

    .jsenv-console pre[data-theme="dark"] {
      background: #111;
      border: 1px solid #333;
      color: #eee;
    }

    .jsenv-console pre[data-theme="light"] {
      background: #1E1E1E;
      border: 1px solid white;
      color: #EEEEEE;
    }

    .jsenv-console pre a {
      color: inherit;
    }
    `
  const html = `
      <style type="text/css">${css}></style>
      <div class="jsenv-console">
        <h1>${title} <button id="button-close-jsenv-console">X</button></h1>
        <pre data-theme="${theme}">${message}</pre>
      </div>
      `
  const removeJsenvConsole = appendHMTLInside(html, document.body)

  document.querySelector("#button-close-jsenv-console").onclick = () => {
    removeJsenvConsole()
  }
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
  } else if (error === undefined) {
    html = "undefined"
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
  return transferChildren(temoraryParent, parentNode)
}

const transferChildren = (fromNode, toNode) => {
  const childNodes = [].slice.call(fromNode.childNodes, 0)
  let i = 0
  while (i < childNodes.length) {
    toNode.appendChild(childNodes[i])
    i++
  }
  return () => {
    let c = 0
    while (c < childNodes.length) {
      fromNode.appendChild(childNodes[c])
      c++
    }
  }
}
