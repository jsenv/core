import { getBrowserSystemSource } from "@dmail/module-loader"

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

const prefixLines = (string, prefix = "  ", { lineSeparator = "auto" } = {}) => {
  if (lineSeparator === "auto") {
    lineSeparator = detectLineSeparator(string)
  }

  const lines = string.split(lineSeparator)

  return lines.map((line, index) => `${index === 0 ? "" : prefix}${line}`).join(lineSeparator)
}

const renderScript = ({ source }) => {
  // https://stackoverflow.com/questions/28643272/how-to-include-an-escapedscript-script-tag-in-a-javascript-variable/28643409#28643409
  return `<script type="text/javascript">
	${source.trim().replace(/\<\/script\>/g, "<\\/script>")}
</script>`
}

export const createHTMLForBrowser = ({ title = "Untitled", charset = "utf-8", script } = {}) => {
  return getBrowserSystemSource().then((loaderSource) => {
    return `<!doctype html>

<head>
  <title>${title}</title>
  <meta charset="${charset}" />
</head>

<body>
  <main></main>
  ${prefixLines(renderScript({ source: loaderSource.code }), "  ")}
  ${prefixLines(
    renderScript({
      source: script,
    }),
    "  ",
  )}
</body>

</html>`
  })
}
