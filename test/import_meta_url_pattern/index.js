/* eslint-env browser */
window.dynamicImportPolyfill = async (url) => {
  const script = document.createElement("script")
  script.src = url
  const loadedPromise = new Promise((resolve, reject) => {
    script.addEventListener("load", () => {
      resolve()
    })
    script.addEventListener("error", () => {
      reject()
    })
  })
  document.body.appendChild(script)
  await loadedPromise
  return "DYNAMIC_IMPORT_POLYFILL_RETURN_VALUE"
}

const jsUrl = new URL("./file.js", import.meta.url)
const jsModuleUrl = new URL("./file.js?module", import.meta.url)

export const jsUrlInstanceOfUrl = jsUrl instanceof URL

export const jsUrlString = String(jsUrl)

const modulePromise = import(jsModuleUrl)
export { modulePromise }
