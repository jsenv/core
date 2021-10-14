import { scanNodeRuntimeFeatures } from "./scanNodeRuntimeFeatures.js"
import { createNodeExecutionWithSystemJs } from "./createNodeExecutionWithSystemJs.js"
import { createNodeExecutionWithDynamicImport } from "./createNodeExecutionWithDynamicImport.js"

export const createNodeRuntime = async ({
  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,
  canUseNativeModuleSystem = true,
}) => {
  const nodeFeatures = await scanNodeRuntimeFeatures({
    compileServerOrigin,
    outDirectoryRelativeUrl,
  })
  const { canAvoidCompilation, compileId, importDefaultExtension } =
    nodeFeatures

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
