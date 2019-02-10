// eslint-disable-next-line import/no-unresolved
import { compileMap, entryPoint } from "bundle-browser-options"
import { detect } from "../../platform/browser/browserDetect/index.js"
import { browserToCompileId } from "../../platform/browser/browserToCompileId.js"

const compileId = browserToCompileId(detect(), compileMap)

const loadUsingScript = async (src) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.charset = "utf-8"
    script.crossOrigin = "anonymous"

    const removeOnWindowError = () => window.removeEventListener("error", onwindowerror)
    const removeOnScriptError = () => script.removeEventListener("error", onscripterror)
    const removeOnScriptLoad = () => script.removeEventListener("load", onscriptload)
    const cleanup = () => {
      removeOnWindowError()
      removeOnScriptError()
      removeOnScriptLoad()
      document.head.removeChild(script)
    }

    const onwindowerror = (e) => {
      cleanup()
      reject(e)
    }
    const onscripterror = () => {
      cleanup()
      reject(new Error(`Error loading ${src}`))
    }
    const onscriptload = () => {
      cleanup()
      resolve()
    }
    window.addEventListener("error", onwindowerror)
    script.addEventListener("error", onscripterror)
    script.addEventListener("load", onscriptload)
    script.src = src
    document.head.insertBefore(script, document.head.firstChild)
  })
}

loadUsingScript(`./${compileId}/${entryPoint}`)
