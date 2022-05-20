import { Parser, getLineInfo } from "acorn"
import { importAssertions } from "acorn-import-assertions"
import { simple } from "acorn-walk"

import { createJsParseError } from "./js_parse_error.js"
import {
  isNewWorkerCall,
  analyzeNewWorkerCall,
  isNewSharedWorkerCall,
  analyzeNewSharedWorkerCall,
  isServiceWorkerRegisterCall,
  analyzeServiceWorkerRegisterCall,
} from "./js_static_analysis/web_worker_entry_point.js"
import {
  isImportScriptsCall,
  analyzeImportScriptCalls,
} from "./js_static_analysis/web_worker.js"
import {
  isNewUrlCall,
  analyzeNewUrlCall,
} from "./js_static_analysis/new_url.js"
import {
  isSystemRegisterCall,
  analyzeSystemRegisterCall,
  isSystemImportCall,
  analyzeSystemImportCall,
} from "./js_static_analysis/system.js"

const AcornParser = Parser.extend(importAssertions)

export const parseJsUrls = ({
  js,
  url, // will be used for syntax error
  isJsModule = false,
  isWebWorker = false,
} = {}) => {
  const jsUrls = []
  if (canSkipStaticAnalysis({ js, isJsModule, isWebWorker })) {
    return jsUrls
  }
  let jsAst
  try {
    // https://github.com/acornjs/acorn/tree/master/acorn#interface
    jsAst = AcornParser.parse(js, {
      locations: true,
      allowAwaitOutsideFunction: true,
      sourceType: isJsModule ? "module" : "script",
      ecmaVersion: 2022,
    })
  } catch (e) {
    if (e && e.name === "SyntaxError") {
      const { line, column } = getLineInfo(js, e.raisedAt)
      throw createJsParseError({
        message: e.message,
        url,
        line,
        column,
      })
    }
    throw e
  }
  const onUrl = (jsUrl) => {
    jsUrls.push(jsUrl)
  }
  const newUrlNodeVisitedByWebWorkers = []
  const onNewUrlNodeInWorker = (newUrlNode) => {
    newUrlNodeVisitedByWebWorkers.push(newUrlNode)
  }
  simple(jsAst, {
    NewExpression: (node) => {
      if (isNewWorkerCall(node)) {
        analyzeNewWorkerCall(node, {
          isJsModule,
          onUrl,
          onNewUrlNode: onNewUrlNodeInWorker,
        })
        return
      }
      if (isNewSharedWorkerCall(node)) {
        analyzeNewSharedWorkerCall(node, {
          isJsModule,
          onUrl,
          onNewUrlNode: onNewUrlNodeInWorker,
        })
        return
      }
      if (isNewUrlCall(node)) {
        if (newUrlNodeVisitedByWebWorkers.includes(node)) {
          return
        }
        analyzeNewUrlCall(node, {
          isJsModule,
          onUrl,
        })
        return
      }
    },
    CallExpression: (node) => {
      if (isServiceWorkerRegisterCall(node)) {
        analyzeServiceWorkerRegisterCall(node, {
          isJsModule,
          onUrl,
          onNewUrlNode: onNewUrlNodeInWorker,
        })
        return
      }
      if (isWebWorker && isImportScriptsCall(node)) {
        analyzeImportScriptCalls(node, {
          onUrl,
        })
        return
      }
      if (!isJsModule && isSystemRegisterCall(node)) {
        analyzeSystemRegisterCall(node, {
          onUrl,
        })
        return
      }
      if (!isJsModule && isSystemImportCall(node)) {
        analyzeSystemImportCall(node, {
          onUrl,
        })
        return
      }
    },
  })
  return jsUrls
}

const canSkipStaticAnalysis = ({ js, isJsModule, isWebWorker }) => {
  if (isJsModule) {
    if (
      js.includes("new URL(") ||
      js.includes("new Worker(") ||
      js.includes("new SharedWorker(") ||
      js.includes("serviceWorker.register(")
    ) {
      return false
    }
  }
  if (!isJsModule) {
    if (
      js.includes("System.") ||
      js.includes("new URL(") ||
      js.includes("new Worker(") ||
      js.includes("new SharedWorker(") ||
      js.includes("serviceWorker.register(")
    ) {
      return false
    }
  }
  if (isWebWorker && js.includes("importScripts(")) {
    return false
  }
  return true
}
