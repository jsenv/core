import { jsenvPluginImportsAnalysis } from "./jsenv_plugin_imports_analysis.js"
import { jsenvPluginUrlAnalysis } from "./jsenv_plugin_url_analysis.js"

export const jsenvPluginUrlReferences = () => {
  return [jsenvPluginImportsAnalysis(), jsenvPluginUrlAnalysis()]
}
