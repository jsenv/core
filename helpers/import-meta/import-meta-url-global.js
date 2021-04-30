/* eslint-env browser */

const getCurrentScriptSrc = () => {
  const { currentScript } = document
  if (currentScript) return currentScript.src

  // https://github.com/amiller-gh/currentScript-polyfill

  const scripts = Array.prototype.slice.call(document.getElementsByTagName("script"))

  const readyScript = scripts.find((script) => {
    return script.readyState === "interactive"
  })
  if (readyScript) return readyScript

  try {
    throw new Error()
  } catch (err) {
    // Find the second match for the "at" string to get file src url from stack.
    // Specifically works with the format of stack traces in IE.
    const stackDetails = /.*at [^(]*\((.*):(.+):(.+)\)$/gi.exec(err.stack)
    const scriptLocation = (stackDetails || [false])[1]
    const line = (stackDetails || [false])[2]
    const currentLocation = document.location.href.replace(document.location.hash, "")

    if (scriptLocation === currentLocation) {
      const source = document.documentElement.outerHTML
      const codeRegExp = new RegExp(
        `(?:[^\\n]+?\\n){0,${line - 2}}[^<]*<script>([\\d\\D]*?)<\\/script>[\\d\\D]*`,
        "i",
      )
      const code = source.replace(codeRegExp, "$1").trim()

      return scripts.find((script) => {
        return script.innerHTML && script.innerHTML.trim() === code
      })
    }

    return scripts.find((script) => {
      return script.src === scriptLocation
    })
  }
}

const url = getCurrentScriptSrc()

export default url
