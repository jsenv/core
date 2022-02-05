import {
  eventSourceClientFiles,
  browserClientFiles,
  toolbarInjectorFiles,
} from "@jsenv/core/src/internal/jsenv_file_selector.js"

export const getScriptsToInject = ({
  jsenvFileSelector,
  canUseScriptTypeModule,

  eventSourceClient,
  browserClient,
  toolbar,
}) => {
  const scriptInjections = []
  const scriptPropertiesFromFile = (file) => {
    return {
      ...(file.selected === "source" || file.selected === "dist_module"
        ? { type: "module" }
        : {}),
      src: file.urlRelativeToProject,
    }
  }
  if (eventSourceClient) {
    const eventSourceFile = jsenvFileSelector.select(eventSourceClientFiles, {
      canUseScriptTypeModule,
    })
    scriptInjections.push({
      ...scriptPropertiesFromFile(eventSourceFile),
      "data-injected": true,
    })
  }
  if (browserClient) {
    const browserClientFile = jsenvFileSelector.select(browserClientFiles, {
      canUseScriptTypeModule,
    })
    scriptInjections.push({
      ...scriptPropertiesFromFile(browserClientFile),
      "data-injected": true,
    })
  }
  if (toolbar) {
    const toolbarInjectorFile = jsenvFileSelector.select(toolbarInjectorFiles, {
      canUseScriptTypeModule,
    })
    scriptInjections.push({
      ...scriptPropertiesFromFile(toolbarInjectorFile),
      "defer": "",
      "async": "",
      "data-injected": true,
    })
  }
  return scriptInjections
}
