window.__supervisor__ = (() => {
  const notImplemented = () => {
    throw new Error(`window.__supervisor__.setup() not called`)
  }
  const supervisor = {
    reportError: notImplemented,
    superviseScript: notImplemented,
    reloadSupervisedScript: notImplemented,
    collectScriptResults: notImplemented,
    getScriptExecutionResults: () => {
      // wait for page to load before collecting script execution results
      const htmlReadyPromise = new Promise((resolve) => {
        if (document.readyState === "complete") {
          resolve()
          return
        }
        const loadCallback = () => {
          window.removeEventListener("load", loadCallback)
          resolve()
        }
        window.addEventListener("load", loadCallback)
      })
      return htmlReadyPromise.then(() => {
        return supervisor.collectScriptResults()
      })
    },
  }

  supervisor.setupReportError = ({
    rootDirectoryUrl,
    errorNotification,
    errorOverlay,
    errorBaseUrl,
    openInEditor,
  }) => {
    let formatError
    error_formatter: {
      formatError = (error, { url, line, column }) => {
        let { message, stack } = normalizeErrorParts(error)
        let errorDetailsPromiseReference = { current: null }
        let tip = `Reported by the browser while executing <code>${window.location.pathname}${window.location.search}</code>.`
        let errorUrlSite

        const errorMeta = extractErrorMeta(error, { url, line, column })

        const resolveUrlSite = ({ url, line, column }) => {
          if (typeof line === "string") line = parseInt(line)
          if (typeof column === "string") column = parseInt(column)

          const inlineUrlMatch = url.match(
            /@L([0-9]+)C([0-9]+)\-L([0-9]+)C([0-9]+)(\.[\w]+)$/,
          )
          if (inlineUrlMatch) {
            const htmlUrl = url.slice(0, inlineUrlMatch.index)
            const tagLineStart = parseInt(inlineUrlMatch[1])
            const tagColumnStart = parseInt(inlineUrlMatch[2])
            const tagLineEnd = parseInt(inlineUrlMatch[3])
            const tagColumnEnd = parseInt(inlineUrlMatch[4])
            const extension = inlineUrlMatch[5]
            url = htmlUrl
            line = tagLineStart + (typeof line === "number" ? line : 0)
            // stackTrace formatted by V8 (chrome)
            if (Error.captureStackTrace) {
              line--
            }
            if (errorMeta.type === "dynamic_import_syntax_error") {
              // syntax error on inline script need line-1 for some reason
              if (Error.captureStackTrace) {
                line--
              } else {
                // firefox and safari need line-2
                line -= 2
              }
            }
            column = tagColumnStart + (typeof column === "number" ? column : 0)
            const fileUrl = resolveFileUrl(url)
            return {
              isInline: true,
              originalUrl: `${fileUrl}@L${tagLineStart}C${tagColumnStart}-L${tagLineEnd}C${tagColumnEnd}${extension}`,
              url: fileUrl,
              line,
              column,
            }
          }
          return {
            isInline: false,
            url: resolveFileUrl(url),
            line,
            column,
          }
        }

        const resolveFileUrl = (url) => {
          let urlObject = new URL(url)
          if (urlObject.origin === window.origin) {
            urlObject = new URL(
              `${urlObject.pathname.slice(1)}${urlObject.search}`,
              rootDirectoryUrl,
            )
          }
          if (urlObject.href.startsWith("file:")) {
            const atFsIndex = urlObject.pathname.indexOf("/@fs/")
            if (atFsIndex > -1) {
              const afterAtFs = urlObject.pathname.slice(
                atFsIndex + "/@fs/".length,
              )
              return new URL(afterAtFs, "file:///").href
            }
          }
          return urlObject.href
        }

        const generateClickableText = (text) => {
          const textWithHtmlLinks = makeLinksClickable(text, {
            createLink: (url, { line, column }) => {
              const urlSite = resolveUrlSite({ url, line, column })
              if (!errorUrlSite && text === stack) {
                onErrorLocated(urlSite, "error.stack")
              }
              if (errorBaseUrl) {
                if (urlSite.url.startsWith(rootDirectoryUrl)) {
                  urlSite.url = `${errorBaseUrl}${urlSite.url.slice(
                    rootDirectoryUrl.length,
                  )}`
                } else {
                  urlSite.url = "file:///mocked_for_snapshots"
                }
              }
              const urlWithLineAndColumn = formatUrlWithLineAndColumn(urlSite)
              return {
                href:
                  url.startsWith("file:") && openInEditor
                    ? `javascript:window.fetch('/__open_in_editor__/${urlWithLineAndColumn}')`
                    : urlSite.url,
                text: urlWithLineAndColumn,
              }
            },
          })
          return textWithHtmlLinks
        }

        const formatErrorText = ({ message, stack, codeFrame }) => {
          let text
          if (message && stack) {
            text = `${generateClickableText(message)}\n${generateClickableText(
              stack,
            )}`
          } else if (stack) {
            text = generateClickableText(stack)
          } else {
            text = generateClickableText(message)
          }
          if (codeFrame) {
            text += `\n\n${generateClickableText(codeFrame)}`
          }
          return text
        }

        const onErrorLocated = (urlSite) => {
          errorUrlSite = urlSite
          errorDetailsPromiseReference.current = (async () => {
            try {
              if (errorMeta.type === "dynamic_import_fetch_error") {
                const response = await window.fetch(
                  `/__get_error_cause__/${
                    urlSite.isInline ? urlSite.originalUrl : urlSite.url
                  }`,
                )

                if (response.status !== 200) {
                  return null
                }
                const causeInfo = await response.json()
                if (!causeInfo) {
                  return null
                }

                const causeText =
                  causeInfo.code === "NOT_FOUND"
                    ? formatErrorText({
                        message: causeInfo.reason,
                        stack: causeInfo.codeFrame,
                      })
                    : formatErrorText({
                        message: causeInfo.stack,
                        stack: causeInfo.codeFrame,
                      })
                return {
                  cause: causeText,
                }
              }
              if (urlSite.line !== undefined) {
                let resourceToFetch = `/__get_code_frame__/${formatUrlWithLineAndColumn(
                  urlSite,
                )}`
                if (!Error.captureStackTrace) {
                  resourceToFetch += `?remap`
                }
                const response = await window.fetch(resourceToFetch)
                const codeFrame = await response.text()
                return {
                  codeFrame: formatErrorText({ message: codeFrame }),
                }
              }
            } catch (e) {
              // happens if server is closed for instance
              return null
            }
            return null
          })()
        }

        // error.stack is more reliable than url/line/column reported on window error events
        // so use it only when error.stack is not available
        if (
          url &&
          !stack &&
          // ignore window.reportError() it gives no valuable info
          !url.endsWith("supervisor.js")
        ) {
          onErrorLocated(resolveUrlSite({ url, line, column }))
        } else if (errorMeta.url) {
          onErrorLocated(resolveUrlSite(errorMeta))
        }

        return {
          theme:
            error && error.cause && error.cause.code === "PARSE_ERROR"
              ? "light"
              : "dark",
          title: "An error occured",
          text: formatErrorText({ message, stack }),
          tip: `${tip}
    <br />
    Click outside to close.`,
          errorDetailsPromise: errorDetailsPromiseReference.current,
        }
      }

      const extractErrorMeta = (error, { line }) => {
        if (!error) {
          return {}
        }
        const { message } = error
        if (!message) {
          return {}
        }

        export_missing: {
          // chrome
          if (message.includes("does not provide an export named")) {
            return {
              type: "dynamic_import_export_missing",
            }
          }
          // firefox
          if (message.startsWith("import not found:")) {
            return {
              type: "dynamic_import_export_missing",
              browser: "firefox",
            }
          }
          // safari
          if (message.startsWith("import binding name")) {
            return {
              type: "dynamic_import_export_missing",
            }
          }
        }

        js_syntax_error: {
          if (error.name === "SyntaxError" && typeof line === "number") {
            return {
              type: "dynamic_import_syntax_error",
            }
          }
        }

        fetch_error: {
          // chrome
          if (
            message.startsWith("Failed to fetch dynamically imported module: ")
          ) {
            const url = error.message.slice(
              "Failed to fetch dynamically imported module: ".length,
            )
            return {
              type: "dynamic_import_fetch_error",
              url,
            }
          }
          // firefox
          if (message === "error loading dynamically imported module") {
            return {
              type: "dynamic_import_fetch_error",
            }
          }
          // safari
          if (message === "Importing a module script failed.") {
            return {
              type: "dynamic_import_fetch_error",
            }
          }
        }

        return {}
      }

      const formatUrlWithLineAndColumn = ({ url, line, column }) => {
        return line === undefined && column === undefined
          ? url
          : column === undefined
          ? `${url}:${line}`
          : `${url}:${line}:${column}`
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

      const makeLinksClickable = (string, { createLink = (url) => url }) => {
        // normalize line breaks
        string = string.replace(/\n/g, "\n")
        string = escapeHtml(string)
        // render links
        string = stringToStringWithLink(string, {
          transform: (url, { line, column }) => {
            const { href, text } = createLink(url, { line, column })
            return link({ href, text })
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
    }

    let displayErrorNotification
    error_notification: {
      const { Notification } = window
      const displayErrorNotificationNotAvailable = () => {}
      const displayErrorNotificationImplementation = ({
        title,
        text,
        icon,
      }) => {
        if (Notification.permission === "granted") {
          const notification = new Notification(title, {
            lang: "en",
            body: text,
            icon,
          })
          notification.onclick = () => {
            window.focus()
          }
        }
      }
      displayErrorNotification =
        typeof Notification === "function"
          ? displayErrorNotificationImplementation
          : displayErrorNotificationNotAvailable
    }

    const JSENV_ERROR_OVERLAY_TAGNAME = "jsenv-error-overlay"
    let displayJsenvErrorOverlay
    error_overlay: {
      displayJsenvErrorOverlay = (params) => {
        let jsenvErrorOverlay = new JsenvErrorOverlay(params)
        document
          .querySelectorAll(JSENV_ERROR_OVERLAY_TAGNAME)
          .forEach((node) => {
            node.parentNode.removeChild(node)
          })
        document.body.appendChild(jsenvErrorOverlay)
        const removeErrorOverlay = () => {
          if (jsenvErrorOverlay && jsenvErrorOverlay.parentNode) {
            document.body.removeChild(jsenvErrorOverlay)
            jsenvErrorOverlay = null
          }
        }
        return removeErrorOverlay
      }

      class JsenvErrorOverlay extends HTMLElement {
        constructor({ theme, title, text, tip, errorDetailsPromise }) {
          super()
          this.root = this.attachShadow({ mode: "open" })
          this.root.innerHTML = `
<style>
  ${overlayCSS}
</style>
<div class="backdrop"></div>
<div class="overlay" data-theme=${theme}>
  <h1 class="title">
    ${title}
  </h1>
  <pre class="text">${text}</pre>
  <div class="tip">
    ${tip}
  </div>
</div>`
          this.root.querySelector(".backdrop").onclick = () => {
            if (!this.parentNode) {
              // not in document anymore
              return
            }
            this.root.querySelector(".backdrop").onclick = null
            this.parentNode.removeChild(this)
          }
          if (errorDetailsPromise) {
            errorDetailsPromise.then((errorDetails) => {
              if (!errorDetails || !this.parentNode) {
                return
              }
              const { codeFrame, cause } = errorDetails
              if (codeFrame) {
                this.root.querySelector(".text").innerHTML += `\n\n${codeFrame}`
              }
              if (cause) {
                const causeIndented = prefixRemainingLines(cause, "  ")
                this.root.querySelector(
                  ".text",
                ).innerHTML += `\n  [cause]: ${causeIndented}`
              }
            })
          }
        }
      }

      const prefixRemainingLines = (text, prefix) => {
        const lines = text.split(/\r?\n/)
        const firstLine = lines.shift()
        let result = firstLine
        let i = 0
        while (i < lines.length) {
          const line = lines[i]
          i++
          result += line.length ? `\n${prefix}${line}` : `\n`
        }
        return result
      }

      if (customElements && !customElements.get(JSENV_ERROR_OVERLAY_TAGNAME)) {
        customElements.define(JSENV_ERROR_OVERLAY_TAGNAME, JsenvErrorOverlay)
      }

      const overlayCSS = `
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
    /* padding is nice + prevents scrollbar from hiding the text behind it */
    /* does not work nicely on firefox though https://bugzilla.mozilla.org/show_bug.cgi?id=748518 */
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
  }`
    }

    supervisor.reportError = (error, { url, line, column, codeFrame }) => {
      const { theme, title, text, tip, errorDetailsPromise } = formatError(
        error,
        {
          rootDirectoryUrl,
          errorBaseUrl,
          openInEditor,
          url,
          line,
          column,
          codeFrame,
        },
      )

      if (errorOverlay) {
        const removeErrorOverlay = displayJsenvErrorOverlay({
          theme,
          title,
          text,
          tip,
          errorDetailsPromise,
        })
        if (window.__reloader__) {
          window.__reloader__.onstatuschange = () => {
            if (window.__reloader__.status === "reloading") {
              removeErrorOverlay()
            }
          }
        }
      }
      if (errorNotification) {
        displayErrorNotification({
          title,
          text,
        })
      }
    }

    window.addEventListener("error", (errorEvent) => {
      if (!errorEvent.isTrusted) {
        // ignore custom error event (not sent by browser)
        return
      }
      const { error, filename, lineno, colno } = errorEvent
      supervisor.reportError(error, {
        url: filename,
        line: lineno,
        column: colno,
      })
    })
  }

  supervisor.setup = ({
    rootDirectoryUrl,
    logs,
    measurePerf,
    errorOverlay,
    errorBaseUrl,
    openInEditor,
  }) => {
    supervisor.setupReportError({
      rootDirectoryUrl,
      errorOverlay,
      errorBaseUrl,
      openInEditor,
    })

    const supervisedScripts = []
    const executionResults = {}
    const executionPromises = []
    supervisor.createExecution = ({ type, src, execute }) => {
      const execution = {
        type,
        src,
        execute,
      }
      execution.start = () => {
        return superviseExecution(execution, { isReload: false })
      }
      execution.reload = () => {
        return superviseExecution(execution, { isReload: true })
      }
      supervisedScripts.push(execution)
      return execution
    }
    const superviseExecution = async (execution, { isReload }) => {
      if (logs) {
        console.group(`[jsenv] loading ${execution.type} ${execution.src}`)
      }
      let completed
      let result
      let error
      if (measurePerf) {
        performance.mark(`execution_start`)
      }
      const executionResult = {
        status: "pending",
        namespace: null,
        coverage: null,
        error: null,
      }
      executionResults[execution.src] = executionResult
      try {
        const promise = execution.execute({ isReload })
        executionPromises.push(promise)
        result = await promise
        completed = true
      } catch (e) {
        completed = false
        error = e
      }
      if (measurePerf) {
        performance.measure(`execution`, `execution_start`)
      }
      if (completed) {
        executionResult.status = "completed"
        executionResult.namespace = result
        executionResult.coverage = window.__coverage__
        if (logs) {
          console.log(`${execution.type} load ended`)
          console.groupEnd()
        }
        return
      }
      executionResult.status = "errored"
      executionResult.coverage = window.__coverage__
      executionResult.error = error
      if (typeof window.reportError === "function") {
        window.reportError(error)
      } else {
        console.error(error)
      }
      if (logs) {
        console.groupEnd()
      }
    }
    supervisor.superviseScript = ({ src, crossorigin, integrity }) => {
      const { currentScript } = document
      const execution = supervisor.createExecution({
        src,
        type: "js_classic",
        execute: ({ isReload }) => {
          return new Promise((resolve, reject) => {
            const urlObject = new URL(src, window.location)
            if (isReload) {
              urlObject.searchParams.set("hmr", Date.now())
            }
            const url = urlObject.href

            const script = document.createElement("script")
            if (crossorigin) {
              script.crossorigin = crossorigin
            }
            if (integrity) {
              script.integrity = integrity
            }
            script.src = url
            let lastWindowErrorUrl
            let lastWindowError
            const windowErrorCallback = (e) => {
              lastWindowErrorUrl = e.filename
              lastWindowError = e.error
            }
            const cleanup = () => {
              // the execution of the script itself can remove script from the page
              if (script.parentNode) {
                script.parentNode.removeChild(script)
              }
              window.removeEventListener("error", windowErrorCallback)
            }
            window.addEventListener("error", windowErrorCallback)
            script.addEventListener("error", () => {
              cleanup()
              reject(src)
            })
            script.addEventListener("load", () => {
              cleanup()
              if (lastWindowErrorUrl === url) {
                if (
                  lastWindowError &&
                  lastWindowError.code === "NETWORK_FAILURE"
                ) {
                  const currentScriptErrorEvent = new Event("error")
                  currentScript.dispatchEvent(currentScriptErrorEvent)
                } else if (typeof lastWindowError === "object") {
                  const globalErrorEvent = new Event("error")
                  globalErrorEvent.filename = lastWindowError.filename
                  globalErrorEvent.lineno =
                    lastWindowError.line || lastWindowError.lineno
                  globalErrorEvent.colno =
                    lastWindowError.column || lastWindowError.columnno
                  globalErrorEvent.message = lastWindowError.message
                  window.dispatchEvent(globalErrorEvent)
                }
                reject(lastWindowError)
              } else {
                resolve()
              }
            })
            if (currentScript) {
              currentScript.parentNode.insertBefore(
                script,
                currentScript.nextSibling,
              )
            } else {
              document.body.appendChild(script)
            }
          })
        },
      })
      execution.start()
    }
    supervisor.reloadSupervisedScript = ({ type, src }) => {
      const supervisedScript = supervisedScripts.find(
        (supervisedScriptCandidate) => {
          if (type && supervisedScriptCandidate.type !== type) {
            return false
          }
          if (supervisedScriptCandidate.src !== src) {
            return false
          }
          return true
        },
      )
      if (supervisedScript) {
        supervisedScript.reload()
      }
    }
    supervisor.collectScriptResults = async () => {
      await Promise.all(executionPromises)
      let status = "completed"
      let exceptionSource = ""
      Object.keys(executionResults).forEach((src) => {
        const executionResult = executionResults[src]
        if (executionResult.status === "errored") {
          status = "errored"
          exceptionSource = executionResult.exceptionSource
        }
      })
      return {
        status,
        startTime: getNavigationStartTime(),
        endTime: Date.now(),
        executionResults,
        ...(status === "errored" ? { exceptionSource } : {}),
      }
    }

    const getNavigationStartTime = () => {
      try {
        return window.performance.timing.navigationStart
      } catch (e) {
        return Date.now()
      }
    }
  }

  return supervisor
})()
