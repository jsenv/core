import { scanNodeRuntimeFeatures } from "./scanNodeRuntimeFeatures.js"
import { createNodeExecutionWithSystemJs } from "./createNodeExecutionWithSystemJs.js"
import { createNodeExecutionWithDynamicImport } from "./createNodeExecutionWithDynamicImport.js"

export const createNodeRuntime = async ({
  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,
  canUseNativeModuleSystem,
}) => {
  const { canAvoidCompilation, compileId, importDefaultExtension } =
    await scanNodeRuntimeFeatures({
      compileServerOrigin,
      outDirectoryRelativeUrl,
    })

  if (canAvoidCompilation && canUseNativeModuleSystem) {
    return createNodeExecutionWithDynamicImport({
      projectDirectoryUrl,
      compileServerOrigin,
    })
  }

  return createNodeExecutionWithSystemJs({
    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,
    compileId,
    importDefaultExtension,
  })
}
