export const loadUsingScript = async (src) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")

    const onwindowerror = (errorEvent) => {
      if (errorEvent.filename === src) {
        cleanup()
        reject(errorEvent.error)
      }
    }

    const onscripterror = () => {
      cleanup()
      reject(new Error(`Error loading ${src}`))
    }

    const onscriptload = () => {
      cleanup()
      resolve()
    }

    const cleanup = () => {
      removeOnWindowError()
      removeOnScriptError()
      removeOnScriptLoad()
      document.head.removeChild(script)
    }

    const removeOnWindowError = () => window.removeEventListener("error", onwindowerror)

    const removeOnScriptError = () => script.removeEventListener("error", onscripterror)

    const removeOnScriptLoad = () => script.removeEventListener("load", onscriptload)

    window.addEventListener("error", onwindowerror)
    script.addEventListener("error", onscripterror)
    script.addEventListener("load", onscriptload)
    script.charset = "utf-8"
    script.crossOrigin = "anonymous"
    script.src = src

    document.head.appendChild(script)
  })
}
