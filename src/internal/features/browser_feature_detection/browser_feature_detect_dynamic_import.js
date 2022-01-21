import {
  asBase64Url,
  executeWithScriptModuleInjection,
} from "./execute_with_script_module.js"

export const supportsDynamicImport = async () => {
  const moduleSource = asBase64Url(`export default 42`)
  try {
    await executeWithScriptModuleInjection(
      `window.__jsenv_runtime_test_dynamic_import__ = import(${JSON.stringify(
        moduleSource,
      )})`,
    )
    const namespace = await window.__jsenv_runtime_test_dynamic_import__
    delete window.__jsenv_runtime_test_dynamic_import__
    return namespace.default === 42
  } catch (e) {
    return false
  }
}
