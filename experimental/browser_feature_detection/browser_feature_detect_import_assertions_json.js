import {
  asBase64Url,
  executeWithScriptModuleInjection,
} from "./execute_with_script_module.js"

export const supportsJsonImportAssertions = async () => {
  const jsonBase64Url = asBase64Url("42", "application/json")
  const moduleSource = asBase64Url(
    `import data from "${jsonBase64Url}" assert { type: "json" }
  export default data`,
  )
  try {
    await executeWithScriptModuleInjection(
      `window.__jsenv_runtime_test_json_import_assertion__ = import(${JSON.stringify(
        moduleSource,
      )})`,
    )
    const namespace = await window.__jsenv_runtime_test_json_import_assertion__
    const supported = namespace.default === 42
    delete window.__jsenv_runtime_test_json_import_assertion__
    return supported
  } catch (e) {
    return false
  }
}
