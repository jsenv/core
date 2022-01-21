export const executeWithScriptModuleInjection = (code) => {
  const scriptModule = document.createElement("script")
  scriptModule.type = "module"

  const loadPromise = new Promise((resolve, reject) => {
    scriptModule.onload = () => {
      document.body.removeChild(scriptModule)
      resolve()
    }
    scriptModule.onerror = () => {
      document.body.removeChild(scriptModule)
      reject()
    }
    document.body.appendChild(scriptModule)
  })

  scriptModule.src = asBase64Url(code)

  return loadPromise
}

export const asBase64Url = (text, mimeType = "application/javascript") => {
  return `data:${mimeType};base64,${window.btoa(text)}`
}
