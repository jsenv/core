import {
  asBase64Url,
  executeWithScriptModuleInjection,
} from "./execute_with_script_module.js"

export const supportsCssImportAssertions = async () => {
  const cssBase64Url = asBase64Url("p { color: red; }", "text/css")
  const moduleSource = asBase64Url(
    `import css from "${cssBase64Url}" assert { type: "css" }
  export default css`,
  )
  try {
    await executeWithScriptModuleInjection(
      `window.__jsenv_runtime_test_css_import_assertion__ = import(${JSON.stringify(
        moduleSource,
      )})`,
    )
    const namespace = await window.__jsenv_runtime_test_css_import_assertion__
    return namespace.default instanceof CSSStyleSheet
  } catch (e) {
    return false
  }
}
