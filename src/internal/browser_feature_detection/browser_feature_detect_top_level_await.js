import { executeWithScriptModuleInjection } from "./execute_with_script_module.js"

export const supportsTopLevelAwait = async () => {
  try {
    await executeWithScriptModuleInjection(
      `window.__jsenv_runtime_test_top_level_await__ = await Promise.resolve(42)`,
    )
    const supported = window.__jsenv_runtime_test_top_level_await__ === 42
    delete window.__jsenv_runtime_test_top_level_await__
    return supported
  } catch (e) {
    return false
  }
}
