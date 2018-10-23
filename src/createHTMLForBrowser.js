const countLeading = (string, predicate) => {
  let leading = 0
  let i = 0
  while (i < string.length) {
    if (predicate(string[i])) {
      i++
      leading++
    } else {
      break
    }
  }
  return leading
}

const detectLineSeparator = (string) => {
  const lineSeparators = ["\r\n", "\r", "\n"]
  return lineSeparators.find((separator) => {
    return string.indexOf(separator) > -1
  })
}

export const detectIndentation = (lines) => {
  const firstLineWithLeadingWhiteSpace = lines.find((line) => {
    return line[0] === " " || line[0] === "\t"
  })

  if (!firstLineWithLeadingWhiteSpace) {
    return ""
  }

  if (firstLineWithLeadingWhiteSpace[0] === " ") {
    return " ".repeat(countLeading(firstLineWithLeadingWhiteSpace), (char) => char === " ")
  }

  return "\t".repeat(countLeading(firstLineWithLeadingWhiteSpace), (char) => char === "\t")
}

const escapeClosingScriptTag = (string) => {
  // https://stackoverflow.com/questions/28643272/how-to-include-an-escapedscript-script-tag-in-a-javascript-variable/28643409#28643409
  return string.replace(/\<\/script\>/g, "<\\/script>")
}

const prefixLineWith = (string, prefix = "  ", { lineSeparator = "auto" } = {}) => {
  if (lineSeparator === "auto") {
    lineSeparator = detectLineSeparator(string)
  }

  const lines = string.split(lineSeparator)

  return lines.map((line, index) => `${index === 0 ? "" : prefix}${line}`).join(lineSeparator)
}

const inlineScriptToHTML = ({ source }) => {
  return `<script type="text/javascript">
  ${escapeClosingScriptTag(source.trim())}
</script>`
}

const remoteScriptToHTML = ({ url, async = false }) => {
  return `<script src="${url}" ${async ? "async " : ""}></script>`
}

export const createHTMLForBrowser = (
  { title = "Untitled", charset = "utf-8", scriptRemoteList = [], scriptInlineList = [] } = {},
) => {
  return `<!doctype html>

<head>
  <title>${title}</title>
  <meta charset="${charset}" />
</head>

<body>
  <main></main>
  ${scriptRemoteList.map((script) => remoteScriptToHTML(script)).join("\n  ")}
  ${scriptInlineList.map((script) => prefixLineWith(inlineScriptToHTML(script), "  ")).join("\n  ")}
</body>

</html>`
}
