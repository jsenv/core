import {
  asBase64Url,
  executeWithScriptModuleInjection,
} from "./execute_with_script_module.js"

export const supportsImportmap = async ({ remote = true } = {}) => {
  if (HTMLScriptElement.supports("importmap")) {
    return true
  }
  const specifier = asBase64Url(`export default false`)
  const importMap = {
    imports: {
      [specifier]: asBase64Url(`export default true`),
    },
  }
  const importmapScript = document.createElement("script")
  const importmapString = JSON.stringify(importMap, null, "  ")
  importmapScript.type = "importmap"
  if (remote) {
    importmapScript.src = `data:application/json;base64,${window.btoa(
      importmapString,
    )}`
  } else {
    importmapScript.textContent = importmapString
  }
  document.body.appendChild(importmapScript)

  try {
    await executeWithScriptModuleInjection(
      `import supported from "${specifier}"; window.__jsenv_runtime_test_importmap__ = supported`,
    )
    document.body.removeChild(importmapScript)
    const supported = window.__jsenv_runtime_test_importmap__
    delete window.__jsenv_runtime_test_importmap__
    return supported
  } catch (e) {
    document.body.removeChild(importmapScript)
    return false
  }
}
