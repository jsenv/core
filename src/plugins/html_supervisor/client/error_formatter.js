export const formatError = (
  error,
  {
    rootDirectoryUrl,
    openInEditor,
    url,
    line,
    column,
    requestedRessource,
    reportedBy,
  },
) => {
  let { message, stack } = normalizeErrorParts(error)
  let tip = formatTip({ reportedBy, requestedRessource })

  if (url && error && error.name === "SyntaxError") {
    // c'est pas vraiment stack qu'on veut update
    // on veut ceci:
    // file.js: Unexpected token (1:0)
    // code frame here
    // idéalement disant qui a requété ce fichier
    stack = `  at ${appendLineAndColumn(url, { line, column })}`
  }

  if (reportedBy === "bowser") {
    // ici on veut plutot profiter de error.stack pour choper line+column
    // et ajouter un codeframe
    // mais si on a pas de stack?
    // si on a stack on peut chopper url/line/column
    // et s'en servir pour augmenter le message avec une partie codeFrame
    // mais cela devrait se produire que sur certains erreurs
    // (les erreur serveur auront déja ce codeframe par example)
  } else if (!stack && url) {
    stack = `  at ${appendLineAndColumn(url, { line, column })}`
  }

  const text = createErrorText({
    rootDirectoryUrl,
    openInEditor,
    message,
    stack,
  })

  return {
    theme:
      error && error.cause && error.cause.code === "PARSE_ERROR"
        ? "light"
        : "dark",
    title: "An error occured",
    text,
    tip: `${tip}
    <br />
    Click outside to close.`,
  }
}

const normalizeErrorParts = (error) => {
  if (error === undefined) {
    return {
      message: "undefined",
    }
  }
  if (error === null) {
    return {
      message: "null",
    }
  }
  if (typeof error === "string") {
    return {
      message: error,
    }
  }
  if (error instanceof Error) {
    if (error.name === "SyntaxError") {
      return {
        message: error.message,
      }
    }
    if (error.cause && error.cause.code === "PARSE_ERROR") {
      if (error.messageHTML) {
        return {
          message: error.messageHTML,
        }
      }
      return {
        message: error.message,
      }
    }
    // stackTrace formatted by V8
    if (Error.captureStackTrace) {
      return {
        message: error.message,
        stack: getErrorStackWithoutErrorMessage(error),
      }
    }
    return {
      message: error.message,
      stack: error.stack ? `  ${error.stack}` : null,
    }
  }
  if (typeof error === "object") {
    return error
  }
  return {
    message: JSON.stringify(error),
  }
}

const getErrorStackWithoutErrorMessage = (error) => {
  let stack = error.stack
  const messageInStack = `${error.name}: ${error.message}`
  if (stack.startsWith(messageInStack)) {
    stack = stack.slice(messageInStack.length)
  }
  const nextLineIndex = stack.indexOf("\n")
  if (nextLineIndex > -1) {
    stack = stack.slice(nextLineIndex + 1)
  }
  return stack
}

const formatTip = ({ reportedBy, requestedRessource }) => {
  if (reportedBy === "browser") {
    return `Reported by the browser while executing <code>${window.location.pathname}${window.location.search}</code>.`
  }
  return `Reported by the server while serving <code>${requestedRessource}</code>`
}

const createErrorText = ({
  rootDirectoryUrl,
  openInEditor,
  message,
  stack,
}) => {
  const generateClickableText = (text) => {
    const textWithHtmlLinks = replaceLinks(text, {
      rootDirectoryUrl,
      openInEditor,
    })
    return textWithHtmlLinks
  }

  if (message && stack) {
    return `${generateClickableText(message)}\n${generateClickableText(stack)}`
  }
  if (stack) {
    return generateClickableText(stack)
  }
  return generateClickableText(message)
}

const replaceLinks = (string, { rootDirectoryUrl, openInEditor }) => {
  // normalize line breaks
  string = string.replace(/\n/g, "\n")
  string = escapeHtml(string)
  // render links
  string = stringToStringWithLink(string, {
    transform: (url, { line, column }) => {
      const inlineUrlMatch = url.match(/@L([0-9]+)\-L([0-9]+)\.[\w]+$/)
      if (inlineUrlMatch) {
        const htmlUrl = url.slice(0, inlineUrlMatch.index)
        const tagLine = parseInt(inlineUrlMatch[1])
        const tagColumn = parseInt(inlineUrlMatch[2])
        url = htmlUrl
        line = tagLine + parseInt(line) - 1
        column = tagColumn + parseInt(column)
      }

      const urlObject = new URL(url)

      const onFileUrl = (fileUrlObject) => {
        const atFsIndex = fileUrlObject.pathname.indexOf("/@fs/")
        let fileUrl
        if (atFsIndex > -1) {
          const afterAtFs = fileUrlObject.pathname.slice(
            atFsIndex + "/@fs/".length,
          )
          fileUrl = new URL(afterAtFs, "file:///").href
        } else {
          fileUrl = fileUrlObject.href
        }
        fileUrl = appendLineAndColumn(fileUrl, {
          line,
          column,
        })
        return link({
          href: openInEditor
            ? `javascript:window.fetch('/__open_in_editor__/${fileUrl}')`
            : fileUrl,
          text: fileUrl,
        })
      }

      if (urlObject.origin === window.origin) {
        const fileUrlObject = new URL(
          `${urlObject.pathname.slice(1)}${urlObject.search}`,
          rootDirectoryUrl,
        )
        return onFileUrl(fileUrlObject)
      }
      if (urlObject.href.startsWith("file:")) {
        return onFileUrl(urlObject)
      }
      return link({
        href: url,
        text: appendLineAndColumn(url, { line, column }),
      })
    },
  })
  return string
}

const escapeHtml = (string) => {
  return string
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
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
        linkHTML = transform(match, {})
      }
    }
    if (endsWithSeparationChar) {
      return `${linkHTML}${lastChar}`
    }
    return linkHTML
  })
}

const link = ({ href, text = href }) => `<a href="${href}">${text}</a>`
