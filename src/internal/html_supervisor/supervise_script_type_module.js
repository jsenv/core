import { htmlSupervisorFiles } from "@jsenv/core/src/internal/jsenv_file_selector.js"

// Ideally jsenv should take into account eventual
// "integrity" and "crossorigin" attribute during supervision
export const generateCodeToSuperviseScriptTypeModule = ({
  jsenvFileSelector,
  canUseScriptTypeModule,
  specifier,
}) => {
  const specifierAsJson = JSON.stringify(specifier)
  if (canUseScriptTypeModule) {
    const htmlSupervisorFile = jsenvFileSelector.select(htmlSupervisorFiles, {
      canUseScriptTypeModule: true,
    })
    return `import { superviseDynamicImport } from "@jsenv/core${htmlSupervisorFile.urlRelativeToProject}"
superviseDynamicImport(${specifierAsJson})`
  }
  return `window.__html_supervisor__.superviseSystemJsImport(${specifierAsJson})`
}
