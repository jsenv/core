import { genericExecuteCompiledFile } from "../genericExecuteCompiledFile.js"
import { pathnameToSourceHref } from "../locaters.js"
import { loadCompileMeta } from "./loadCompileMeta.js"
import { loadImporter } from "./loadImporter.js"
import { rejectionValueToMeta } from "./rejectionValueToMeta.js"

export const executeCompiledFile = ({
  compileInto,
  compiledRootHref,
  collectNamespace,
  collectCoverage,
  instrument = {},
  pathname,
}) =>
  genericExecuteCompiledFile({
    loadCompileMeta: () => loadCompileMeta({ compileInto, compiledRootHref }),
    loadImporter: () => loadImporter({ compileInto, compiledRootHref }),
    compileInto,
    compiledRootHref,
    collectNamespace,
    collectCoverage,
    instrument,
    pathname,
    readCoverage,
    onError,
    transformError,
  })

const readCoverage = () => window.__coverage__

const transformError = (error) => {
  if (error && error.code === "MODULE_INSTANTIATE_ERROR") {
    return exceptionToObject(error.error)
  }
  return exceptionToObject(error)
}

const exceptionToObject = (exception) => {
  // we need to convert error to an object to make it stringifiable
  if (exception && exception instanceof Error) {
    const object = {}
    Object.getOwnPropertyNames(exception).forEach((name) => {
      object[name] = exception[name]
    })
    return object
  }

  return {
    message: exception,
  }
}

const onError = (error, { compileInto, compiledRootHref, pathname }) => {
  const meta = rejectionValueToMeta(error, {
    compileInto,
    compiledRootHref,
  })

  const css = `
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

  const html = `
      <style type="text/css">${css}></style>
      <div class="jsenv-console">
        <h1>
          <a href="${pathnameToSourceHref({
            pathname,
            compiledRootHref,
          })}">${pathname}</a> import rejected
        </h1>
        <pre data-theme="${meta.dataTheme || "dark"}">${meta.data}</pre>
      </div>
      `
  appendHMTL(html, document.body)
  console.error(error)
}

const appendHMTL = (html, parentNode) => {
  const temoraryParent = document.createElement("div")
  temoraryParent.innerHTML = html
  transferChildren(temoraryParent, parentNode)
}

const transferChildren = (fromNode, toNode) => {
  while (fromNode.firstChild) {
    toNode.appendChild(fromNode.firstChild)
  }
}
