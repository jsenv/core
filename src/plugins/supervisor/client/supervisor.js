window.__supervisor__ = (() => {
  const notImplemented = () => {
    throw new Error(`window.__supervisor__.setup() not called`)
  }
  const executionResults = {}
  const supervisor = {
    reportError: notImplemented,
    superviseScript: notImplemented,
    reloadSupervisedScript: notImplemented,
    getDocumentExecutionResult: notImplemented,
    executionResults,
  }

  let navigationStartTime
  try {
    navigationStartTime = window.performance.timing.navigationStart
  } catch (e) {
    navigationStartTime = Date.now()
  }

  supervisor.setupReportException = ({
    rootDirectoryUrl,
    serverIsJsenvDevServer,
    errorNotification,
    errorOverlay,
    errorBaseUrl,
    openInEditor,
  }) => {
    const DYNAMIC_IMPORT_FETCH_ERROR = "dynamic_import_fetch_error"
    const DYNAMIC_IMPORT_EXPORT_MISSING = "dynamic_import_export_missing"
    const DYNAMIC_IMPORT_SYNTAX_ERROR = "dynamic_import_syntax_error"

    const createException = ({
      reason,
      reportedBy,
      url,
      line,
      column,
    } = {}) => {
      const exception = {
        reason,
        reportedBy,
        isError: false, // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/throw
        code: null,
        message: null,
        stack: null,
        stackFormatIsV8: null,
        stackSourcemapped: null,
        originalStack: null,
        meta: null,
        site: {
          isInline: null,
          url: null,
          line: null,
          column: null,
          originalUrl: null,
        },
      }

      const writeBasicProperties = () => {
        if (reason === undefined) {
          exception.message = "undefined"
          return
        }
        if (reason === null) {
          exception.message = "null"
          return
        }
        if (typeof reason === "string") {
          exception.message = reason
          return
        }
        if (reason instanceof Error) {
          const error = reason
          let message = error.message
          exception.isError = true
          if (Error.captureStackTrace) {
            // stackTrace formatted by V8
            exception.message = message
            exception.stack = getErrorStackWithoutErrorMessage(error)
            exception.stackFormatIsV8 = true
            exception.stackSourcemapped = true
          } else {
            exception.message = message
            exception.stack = error.stack ? `  ${error.stack}` : null
            exception.stackFormatIsV8 = false
            exception.stackSourcemapped = false
          }
          if (error.reportedBy) {
            exception.reportedBy = error.reportedBy
          }
          if (error.url) {
            Object.assign(exception.site, resolveUrlSite({ url: error.url }))
          }
          if (error.needsReport) {
            exception.needsReport = true
          }
          export_missing: {
            // chrome
            if (message.includes("does not provide an export named")) {
              exception.code = DYNAMIC_IMPORT_EXPORT_MISSING
              return
            }
            // firefox
            if (
              message.startsWith("import not found:") ||
              message.startsWith("ambiguous indirect export:")
            ) {
              exception.code = DYNAMIC_IMPORT_EXPORT_MISSING
              return
            }
            // safari
            if (message.startsWith("import binding name")) {
              exception.code = DYNAMIC_IMPORT_EXPORT_MISSING
              return
            }
          }
          js_syntax_error: {
            if (error.name === "SyntaxError" && typeof line === "number") {
              exception.code = DYNAMIC_IMPORT_SYNTAX_ERROR
              return
            }
          }
          return
        }
        if (typeof reason === "object") {
          exception.code = reason.code
          exception.message = reason.message
          exception.stack = reason.stack
          if (reason.reportedBy) {
            exception.reportedBy = reason.reportedBy
          }
          if (reason.url) {
            Object.assign(exception.site, resolveUrlSite({ url: reason.url }))
          }
          if (reason.needsReport) {
            exception.needsReport = true
          }
          return
        }
        exception.message = JSON.stringify(reason)
      }
      writeBasicProperties()

      // first create a version of the stack with file://
      // (and use it to locate exception url+line+column)
      if (exception.stack) {
        exception.originalStack = exception.stack
        exception.stack = replaceUrls(
          exception.originalStack,
          (serverUrlSite) => {
            const fileUrlSite = resolveUrlSite(serverUrlSite)
            if (exception.site.url === null) {
              Object.assign(exception.site, fileUrlSite)
            }
            return stringifyUrlSite(fileUrlSite)
          },
        )
      }
      // then if it fails, use url+line+column passed
      if (exception.site.url === null && url) {
        if (typeof line === "string") {
          line = parseInt(line)
        }
        if (typeof column === "string") {
          column = parseInt(column)
        }
        const fileUrlSite = resolveUrlSite({ url, line, column })
        if (
          fileUrlSite.isInline &&
          exception.code === DYNAMIC_IMPORT_SYNTAX_ERROR
        ) {
          // syntax error on inline script need line-1 for some reason
          if (Error.captureStackTrace) {
            fileUrlSite.line--
          } else {
            // firefox and safari need line-2
            fileUrlSite.line -= 2
          }
        }
        Object.assign(exception.site, fileUrlSite)
      }
      exception.text = stringifyMessageAndStack(exception)
      return exception
    }

    const stringifyMessageAndStack = ({ message, stack }) => {
      if (message && stack) {
        return `${message}\n${stack}`
      }
      if (stack) {
        return stack
      }
      return message
    }

    const stringifyUrlSite = ({ url, line, column }) => {
      if (typeof line === "number" && typeof column === "number") {
        return `${url}:${line}:${column}`
      }
      if (typeof line === "number") {
        return `${url}:${line}`
      }
      return url
    }

    const resolveUrlSite = ({ url, line, column }) => {
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
        column = tagColumnStart + (typeof column === "number" ? column : 0)
        const fileUrl = resolveFileUrl(url)
        return {
          isInline: true,
          serverUrl: url,
          originalUrl: `${fileUrl}@L${tagLineStart}C${tagColumnStart}-L${tagLineEnd}C${tagColumnEnd}${extension}`,
          url: fileUrl,
          line,
          column,
        }
      }
      return {
        isInline: false,
        serverUrl: url,
        url: resolveFileUrl(url),
        line,
        column,
      }
    }

    const getErrorStackWithoutErrorMessage = (error) => {
      let stack = error.stack
      if (!stack) return ""
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
          const afterAtFs = urlObject.pathname.slice(atFsIndex + "/@fs/".length)
          return new URL(afterAtFs, "file:///").href
        }
      }
      return urlObject.href
    }

    // `Error: yo
    // at Object.execute (http://127.0.0.1:57300/build/src/__test__/file-throw.js:9:13)
    // at doExec (http://127.0.0.1:3000/src/__test__/file-throw.js:452:38)
    // at postOrderExec (http://127.0.0.1:3000/src/__test__/file-throw.js:448:16)
    // at http://127.0.0.1:3000/src/__test__/file-throw.js:399:18`.replace(/(?:https?|ftp|file):\/\/(.*+)$/gm, (...args) => {
    //   debugger
    // })
    const replaceUrls = (source, replace) => {
      return source.replace(/(?:https?|ftp|file):\/\/\S+/gm, (match) => {
        let replacement = ""
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
          const lineString = lineAndColumMatch[1]
          const columnString = lineAndColumMatch[2]
          replacement = replace({
            url: match.slice(0, -lineAndColumnString.length),
            line: lineString ? parseInt(lineString) : null,
            column: columnString ? parseInt(columnString) : null,
          })
        } else {
          const linePattern = /:([0-9]+)$/
          const lineMatch = match.match(linePattern)
          if (lineMatch) {
            const lineString = lineMatch[0]
            replacement = replace({
              url: match.slice(0, -lineString.length),
              line: lineString ? parseInt(lineString) : null,
            })
          } else {
            replacement = replace({
              url: match,
            })
          }
        }
        if (endsWithSeparationChar) {
          return `${replacement}${lastChar}`
        }
        return replacement
      })
    }

    let formatError
    error_formatter: {
      formatError = (exceptionInfo) => {
        const errorParts = {
          theme: "dark",
          title: "An error occured",
          text: "",
          tip: "",
          errorDetailsPromise: null,
        }
        const tips = []
        tips.push("Click outside to close.")
        errorParts.tip = tips.join(`\n    <br />\n    `)

        const generateClickableText = (text) => {
          const textWithHtmlLinks = makeLinksClickable(text, {
            createLink: ({ url, line, column }) => {
              const urlSite = resolveUrlSite({ url, line, column })
              if (errorBaseUrl) {
                if (urlSite.url.startsWith(rootDirectoryUrl)) {
                  urlSite.url = `${errorBaseUrl}${urlSite.url.slice(
                    rootDirectoryUrl.length,
                  )}`
                } else {
                  urlSite.url = "file:///mocked_for_snapshots"
                }
              }
              const urlWithLineAndColumn = stringifyUrlSite(urlSite)
              return {
                href:
                  urlSite.url.startsWith("file:") && openInEditor
                    ? `javascript:window.fetch('/__open_in_editor__/${encodeURIComponent(
                        urlWithLineAndColumn,
                      )}')`
                    : urlSite.url,
                text: urlWithLineAndColumn,
              }
            },
          })
          return textWithHtmlLinks
        }

        errorParts.text = stringifyMessageAndStack({
          message: exceptionInfo.message
            ? generateClickableText(exceptionInfo.message)
            : "",
          stack: exceptionInfo.stack
            ? generateClickableText(exceptionInfo.stack)
            : "",
        })
        if (exceptionInfo.site.url) {
          errorParts.errorDetailsPromise = (async () => {
            if (!serverIsJsenvDevServer) {
              return null
            }
            try {
              if (
                exceptionInfo.code === DYNAMIC_IMPORT_FETCH_ERROR ||
                exceptionInfo.reportedBy === "script_error_event"
              ) {
                const response = await window.fetch(
                  `/__get_error_cause__/${encodeURIComponent(
                    exceptionInfo.site.isInline
                      ? exceptionInfo.site.originalUrl
                      : exceptionInfo.site.url,
                  )}`,
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
                    ? stringifyMessageAndStack({
                        message: generateClickableText(causeInfo.reason),
                        stack: generateClickableText(causeInfo.codeFrame),
                      })
                    : stringifyMessageAndStack({
                        message: generateClickableText(causeInfo.stack),
                        stack: generateClickableText(causeInfo.codeFrame),
                      })
                return {
                  cause: causeText,
                }
              }
              if (
                exceptionInfo.site.line !== undefined &&
                // code frame showing internal window.reportError is pointless
                !exceptionInfo.site.url.endsWith(
                  `script_type_module_supervisor.js`,
                )
              ) {
                const urlToFetch = new URL(
                  `/__get_code_frame__/${encodeURIComponent(
                    stringifyUrlSite(exceptionInfo.site),
                  )}`,
                  window.origin,
                )
                if (!exceptionInfo.stackSourcemapped) {
                  urlToFetch.searchParams.set("remap", "")
                }
                const response = await window.fetch(urlToFetch)
                if (response.status !== 200) {
                  return null
                }
                const codeFrame = await response.text()
                return {
                  codeFrame: generateClickableText(codeFrame),
                }
              }
            } catch (e) {
              // happens if server is closed for instance
              return null
            }
            return null
          })()
        }
        return errorParts
      }

      const makeLinksClickable = (
        string,
        { createLink = ({ url }) => url },
      ) => {
        // normalize line breaks
        string = string.replace(/\n/g, "\n")
        string = escapeHtml(string)
        // render links
        string = replaceUrls(string, ({ url, line, column }) => {
          const { href, text } = createLink({ url, line, column })
          return link({ href, text })
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

      const link = ({ href, text = href }) => `<a href="${href}">${text}</a>`
    }

    let displayErrorNotification
    error_notification: {
      const { Notification } = window
      displayErrorNotification =
        typeof Notification === "function"
          ? ({ title, text, icon }) => {
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
          : () => {}
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

    supervisor.createException = createException
    supervisor.reportException = (exception) => {
      const { theme, title, text, tip, errorDetailsPromise } =
        formatError(exception)

      if (errorOverlay) {
        const removeErrorOverlay = displayJsenvErrorOverlay({
          theme,
          title,
          text,
          tip,
          errorDetailsPromise,
        })
        if (window.__reloader__) {
          const onchange = window.__reloader__.status.onchange
          window.__reloader__.status.onchange = () => {
            onchange()
            if (window.__reloader__.status.value === "reloading") {
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
      return exception
    }
    window.addEventListener("error", (errorEvent) => {
      if (!errorEvent.isTrusted) {
        // ignore custom error event (not sent by browser)
        return
      }
      const { error, message, filename, lineno, colno } = errorEvent
      const exception = supervisor.createException({
        // when error is reported within a worker error is null
        // but there is a message property on errorEvent
        reason: error || message,
        reportedBy: "window_error_event",
        url: filename,
        line: lineno,
        column: colno,
      })
      supervisor.reportException(exception)
    })
    window.addEventListener("unhandledrejection", (event) => {
      if (event.defaultPrevented) {
        return
      }
      const exception = supervisor.createException({
        reason: event.reason,
        reportedBy: "window_unhandledrejection_event",
      })
      supervisor.reportException(exception)
    })
  }

  supervisor.setup = ({
    rootDirectoryUrl,
    serverIsJsenvDevServer,
    logs,
    errorOverlay,
    errorBaseUrl,
    openInEditor,
  }) => {
    supervisor.setupReportException({
      serverIsJsenvDevServer,
      rootDirectoryUrl,
      errorOverlay,
      errorBaseUrl,
      openInEditor,
    })

    const supervisedScripts = []
    const pendingPromises = []
    // respect execution order
    // - wait for classic scripts to be done (non async)
    // - wait module script previous execution (non async)
    // see https://gist.github.com/jakub-g/385ee6b41085303a53ad92c7c8afd7a6#typemodule-vs-non-module-typetextjavascript-vs-script-nomodule
    const executionQueue = []
    let executing = false
    const addToExecutionQueue = async (execution) => {
      if (execution.async) {
        execution.start()
        return
      }
      if (executing) {
        executionQueue.push(execution)
        return
      }
      startThenDequeue(execution)
    }
    const startThenDequeue = async (execution) => {
      executing = true
      const promise = execution.start()
      await promise
      executing = false
      if (executionQueue.length) {
        const nextExecution = executionQueue.shift()
        startThenDequeue(nextExecution)
      }
    }
    supervisor.addExecution = ({ type, src, async, execute }) => {
      const execution = {
        type,
        src,
        async,
        execute,
      }
      execution.start = () => {
        return superviseExecution(execution, { isReload: false })
      }
      execution.reload = () => {
        return superviseExecution(execution, { isReload: true })
      }
      supervisedScripts.push(execution)
      return addToExecutionQueue(execution)
    }
    const superviseExecution = async (execution, { isReload }) => {
      if (logs) {
        console.group(`[jsenv] loading ${execution.type} ${execution.src}`)
      }
      const executionResult = {
        status: "pending",
        loadDuration: null,
        executionDuration: null,
        duration: null,
        exception: null,
        namespace: null,
        coverage: null,
      }
      executionResults[execution.src] = executionResult

      const monitorScriptLoad = () => {
        const loadStartTime = Date.now()
        let resolveScriptLoadPromise
        const scriptLoadPromise = new Promise((resolve) => {
          resolveScriptLoadPromise = resolve
        })
        pendingPromises.push(scriptLoadPromise)
        return () => {
          const loadEndTime = Date.now()
          executionResult.loadDuration = loadEndTime - loadStartTime
          resolveScriptLoadPromise()
        }
      }
      const monitorScriptExecution = () => {
        const executionStartTime = Date.now()
        let resolveExecutionPromise
        const executionPromise = new Promise((resolve) => {
          resolveExecutionPromise = resolve
        })
        pendingPromises.push(executionPromise)
        return () => {
          executionResult.coverage = window.__coverage__
          executionResult.executionDuration = Date.now() - executionStartTime
          executionResult.duration =
            executionResult.loadDuration + executionResult.executionDuration
          resolveExecutionPromise()
        }
      }

      const onError = (e) => {
        executionResult.status = "failed"
        const exception = supervisor.createException({ reason: e })
        if (exception.needsReport) {
          supervisor.reportException(exception)
        }
        executionResult.exception = exception
      }

      const scriptLoadDone = monitorScriptLoad()
      try {
        const result = await execution.execute({ isReload })
        if (logs) {
          console.log(`${execution.type} load ended`)
          console.groupEnd()
        }
        executionResult.status = "loaded"
        scriptLoadDone()

        const scriptExecutionDone = monitorScriptExecution()
        if (execution.type === "js_classic") {
          executionResult.status = "completed"
          scriptExecutionDone()
        } else if (execution.type === "js_module") {
          result.executionPromise.then(
            (namespace) => {
              executionResult.status = "completed"
              executionResult.namespace = namespace
              scriptExecutionDone()
            },
            (e) => {
              onError(e)
              scriptExecutionDone()
            },
          )
        }
      } catch (e) {
        if (logs) {
          console.groupEnd()
        }
        onError(e)
        scriptLoadDone()
      }
    }

    supervisor.superviseScript = async ({ src, async }) => {
      const { currentScript } = document
      const parentNode = currentScript.parentNode
      let nodeToReplace
      let currentScriptClone

      return supervisor.addExecution({
        src,
        type: "js_classic",
        async,
        execute: async ({ isReload }) => {
          const urlObject = new URL(src, window.location)
          const loadPromise = new Promise((resolve, reject) => {
            // do not use script.cloneNode()
            // bcause https://stackoverflow.com/questions/28771542/why-dont-clonenode-script-tags-execute
            currentScriptClone = document.createElement("script")
            // browsers set async by default when creating script(s)
            // we want an exact copy to preserves how code is executed
            currentScriptClone.async = false
            Array.from(currentScript.attributes).forEach((attribute) => {
              currentScriptClone.setAttribute(
                attribute.nodeName,
                attribute.nodeValue,
              )
            })
            if (isReload) {
              urlObject.searchParams.set("hmr", Date.now())
              nodeToReplace = currentScriptClone
              currentScriptClone.src = urlObject.href
            } else {
              currentScriptClone.removeAttribute("jsenv-cooked-by")
              currentScriptClone.removeAttribute("jsenv-inlined-by")
              currentScriptClone.removeAttribute("jsenv-injected-by")
              currentScriptClone.removeAttribute("inlined-from-src")
              currentScriptClone.removeAttribute("original-position")
              currentScriptClone.removeAttribute("original-src-position")
              nodeToReplace = currentScript
              currentScriptClone.src = src
            }
            currentScriptClone.addEventListener("error", reject)
            currentScriptClone.addEventListener("load", resolve)
            parentNode.replaceChild(currentScriptClone, nodeToReplace)
          })
          try {
            await loadPromise
          } catch (e) {
            // eslint-disable-next-line no-throw-literal
            throw {
              message: `Failed to fetch script: ${urlObject.href}`,
              reportedBy: "script_error_event",
              url: urlObject.href,
              // window.error won't be dispatched for this error
              needsReport: true,
            }
          }
        },
      })
    }
    supervisor.reloadSupervisedScript = ({ type, src }) => {
      const supervisedScript = supervisedScripts.find(
        (supervisedScriptCandidate) => {
          if (type && supervisedScriptCandidate.type !== type) {
            return false
          }
          return supervisedScriptCandidate.src === src
        },
      )
      if (supervisedScript) {
        supervisedScript.reload()
      }
    }

    // https://twitter.com/damienmaillard/status/1554752482273787906
    const isWebkitOrSafari =
      typeof window.webkitConvertPointFromNodeToPage === "function"
    supervisor.superviseScriptTypeModule = ({ src, async }, importFn) => {
      const currentScript = document.querySelector(
        `script[type="module"][inlined-from-src="${src}"]`,
      )
      const execute = isWebkitOrSafari
        ? createExecuteWithDynamicImport({ src }, importFn)
        : createExecuteWithScript({ currentScript, src }, importFn)
      return window.__supervisor__.addExecution({
        src,
        async,
        type: "js_module",
        execute,
      })
    }

    const createExecuteWithScript = ({ currentScript, src }, importFn) => {
      const parentNode = currentScript.parentNode
      let nodeToReplace
      let currentScriptClone
      return async ({ isReload }) => {
        const urlObject = new URL(src, window.location)
        const loadPromise = new Promise((resolve, reject) => {
          currentScriptClone = document.createElement("script")
          // browsers set async by default when creating script(s)
          // we want an exact copy to preserves how code is executed
          currentScriptClone.async = false
          Array.from(currentScript.attributes).forEach((attribute) => {
            currentScriptClone.setAttribute(
              attribute.nodeName,
              attribute.nodeValue,
            )
          })
          if (isReload) {
            urlObject.searchParams.set("hmr", Date.now())
            nodeToReplace = currentScriptClone
            currentScriptClone.src = urlObject.href
          } else {
            currentScriptClone.removeAttribute("jsenv-cooked-by")
            currentScriptClone.removeAttribute("jsenv-inlined-by")
            currentScriptClone.removeAttribute("jsenv-injected-by")
            currentScriptClone.removeAttribute("inlined-from-src")
            currentScriptClone.removeAttribute("original-position")
            currentScriptClone.removeAttribute("original-src-position")
            nodeToReplace = currentScript
            currentScriptClone.src = src
          }
          currentScriptClone.addEventListener("error", reject)
          currentScriptClone.addEventListener("load", resolve)
          parentNode.replaceChild(currentScriptClone, nodeToReplace)
        })
        try {
          await loadPromise
        } catch (e) {
          // eslint-disable-next-line no-throw-literal
          throw {
            message: `Failed to fetch module: ${urlObject.href}`,
            reportedBy: "script_error_event",
            url: urlObject.href,
            // window.error won't be dispatched for this error
            needsReport: true,
          }
        }
        try {
          return {
            executionPromise: importFn(urlObject.href),
          }
        } catch (e) {
          e.reportedBy = "dynamic_import"
          throw e
        }
      }
    }
    const createExecuteWithDynamicImport = ({ src }, importFn) => {
      return async ({ isReload }) => {
        const urlObject = new URL(src, window.location)
        if (isReload) {
          urlObject.searchParams.set("hmr", Date.now())
        }
        try {
          const namespace = await importFn(urlObject.href)
          return {
            executionPromise: Promise.resolve(namespace),
          }
        } catch (e) {
          e.reportedBy = "dynamic_import"
          // dynamic import would hide the error to the browser
          // so it must be re-reported using window.reportError
          if (typeof window.reportError === "function") {
            window.reportError(e)
          } else {
            console.error(e)
          }
          throw e
        }
      }
    }

    const waitScriptExecutions = async () => {
      const numberOfPromises = pendingPromises.length
      await Promise.all(pendingPromises)
      // new scripts added while the other where executing
      // (should happen only on webkit where
      // script might be added after window load event)
      await new Promise((resolve) => setTimeout(resolve))
      if (pendingPromises.length > numberOfPromises) {
        await waitScriptExecutions()
      }
    }

    let endTime
    const documentExecutionPromise = (async () => {
      // to be super safe and ensure any <script type="module"> got a chance to execute
      const documentReadyPromise = new Promise((resolve) => {
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
      await documentReadyPromise
      await waitScriptExecutions()
      endTime = Date.now()
    })()

    const supervisedJsModules = {}
    supervisor.jsModuleStart = (url) => {
      const executionPromise = new Promise((resolve, reject) => {
        supervisedJsModules[url] = { resolve, reject }
      })
      supervisor.addExecution({
        src: url,
        type: "js_module",
        execute: () => {
          return { executionPromise }
        },
      })
    }
    supervisor.jsModuleEnd = (url) => {
      supervisedJsModules[url].resolve()
    }
    supervisor.jsModuleError = (url, error) => {
      supervisedJsModules[url].reject(error)
    }

    const supervisedJsClassics = {}
    supervisor.jsClassicStart = (url) => {
      const executionPromise = new Promise((resolve, reject) => {
        supervisedJsClassics[url] = { resolve, reject }
      })
      supervisor.addExecution({
        src: url,
        type: "js_classic",
        execute: () => executionPromise,
      })
    }
    supervisor.jsClassicEnd = (url) => {
      supervisedJsClassics[url].resolve()
    }
    supervisor.jsClassicError = (url, error) => {
      supervisedJsClassics[url].reject(error)
    }

    supervisor.getDocumentExecutionResult = async () => {
      await documentExecutionPromise
      if (pendingPromises.length) {
        await waitScriptExecutions()
        endTime = Date.now()
      }
      return {
        status: "completed",
        executionResults,
        startTime: navigationStartTime,
        endTime,
      }
    }
  }

  return supervisor
})()
