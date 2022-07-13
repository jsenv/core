const JSENV_ERROR_OVERLAY_TAGNAME = "jsenv-error-overlay"

export const displayErrorInDocument = (error, { rootDirectoryUrl }) => {
  document.querySelectorAll(JSENV_ERROR_OVERLAY_TAGNAME).forEach((node) => {
    node.parentNode.removeChild(node)
  })
  const title = "An error occured"
  let theme =
    error && error.cause && error.cause.code === "PARSE_ERROR"
      ? "light"
      : "dark"
  let message = errorToHTML(error, { rootDirectoryUrl })
  const jsenvErrorOverlay = new JsenvErrorOverlay({
    theme,
    title,
    message,
  })
  document.body.appendChild(jsenvErrorOverlay)
}

class JsenvErrorOverlay extends HTMLElement {
  constructor({ title, message, theme = "dark" }) {
    super()
    this.root = this.attachShadow({ mode: "open" })
    this.root.innerHTML = overlayHtml
    this.root.querySelector(".overlay").setAttribute("data-theme", theme)
    this.root.querySelector(".title").innerHTML = title
    this.root.querySelector(".message").innerHTML = message
    this.root.querySelector(".backdrop").onclick = () => {
      if (!this.parentNode) {
        // not in document anymore
        return
      }
      this.root.querySelector(".backdrop").onclick = null
      this.parentNode.removeChild(this)
    }
  }
}

if (customElements && !customElements.get(JSENV_ERROR_OVERLAY_TAGNAME)) {
  customElements.define(JSENV_ERROR_OVERLAY_TAGNAME, JsenvErrorOverlay)
}

const overlayHtml = `
<style>
:host {
  position: fixed;
  z-index: 99999;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow-y: scroll;
  margin: 0;
  background: rgba(0, 0, 0, 0.66);
}

.backdrop {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
}

.overlay {
  position: relative;
  background: rgba(0, 0, 0, 0.95);
  width: 800px;
  margin: 30px auto;
  padding: 25px 40px;
  padding-top: 0;
  overflow: hidden; /* for h1 margins */
  border-radius: 4px 8px;
  box-shadow: 0 20px 40px rgb(0 0 0 / 30%), 0 15px 12px rgb(0 0 0 / 20%);
  box-sizing: border-box;
  font-family: monospace;
  direction: ltr;
}

h1 {
  color: red;
  text-align: center;
}

pre {
  overflow: auto;
  max-width: 100%;
  /* avoid scrollbar to hide the text behind it */
  padding: 20px;
}

.tip {
  border-top: 1px solid #999;
  padding-top: 12px;
}

[data-theme="dark"] {
  color: #999;
}
[data-theme="dark"] pre {
  background: #111;
  border: 1px solid #333;
  color: #eee;
}

[data-theme="light"] {
  color: #EEEEEE;
}
[data-theme="light"] pre {
  background: #1E1E1E;
  border: 1px solid white;
  color: #EEEEEE;
}

pre a {
  color: inherit;
}
</style>
<div class="backdrop"></div>
<div class="overlay">
  <h1 class="title"></h1>
  <pre class="message"></pre>
  <div class="tip">Click outside to close</div>
</div>
`

const escapeHtml = (string) => {
  return string
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

const errorToHTML = (error, { rootDirectoryUrl }) => {
  let html

  if (error && error instanceof Error) {
    if (error.cause && error.cause.code === "PARSE_ERROR") {
      html = error.messageHTML || escapeHtml(error.message)
    }
    // stackTrace formatted by V8
    else if (Error.captureStackTrace) {
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
    transform: (url, { line, column }) => {
      const urlObject = new URL(url)
      if (urlObject.origin === window.origin) {
        const fileUrl = appendLineAndColumn(
          new URL(
            `${urlObject.pathname.slice(1)}${urlObject.search}`,
            rootDirectoryUrl,
          ).href,
          {
            line,
            column,
          },
        )
        return link({
          href: `javascript:window.fetch('/__open_in_editor__/${fileUrl}')`,
          text: fileUrl,
        })
      }
      return link({
        href: url,
        text: appendLineAndColumn(url, { line, column }),
      })
    },
  })
  return htmlWithLinks
}

const appendLineAndColumn = (url, { line, column }) => {
  if (line !== undefined && column !== undefined) {
    return `${url}:${line}:${column}`
  }
  if (line !== undefined) {
    return `${url}:${line}`
  }
  return url
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
      linkHTML = transform(match.slice(0, -lineAndColumnString.length), {
        line: lineNumber,
        column: columnNumber,
      })
    } else {
      const linePattern = /:([0-9]+)$/
      const lineMatch = match.match(linePattern)
      if (lineMatch) {
        const lineString = lineMatch[0]
        const lineNumber = lineMatch[1]
        linkHTML = transform(match.slice(0, -lineString.length), {
          line: lineNumber,
        })
      } else {
        linkHTML = transform(match)
      }
    }
    if (endsWithSeparationChar) {
      return `${linkHTML}${lastChar}`
    }
    return linkHTML
  })
}

const link = ({ href, text = href }) => `<a href="${href}">${text}</a>`
