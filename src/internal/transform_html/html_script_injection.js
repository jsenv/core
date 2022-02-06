import {
  eventSourceClientFiles,
  htmlSupervisorFiles,
  htmlSupervisorSetupFiles,
  toolbarInjectorFiles,
} from "@jsenv/core/src/internal/jsenv_file_selector.js"

export const getScriptsToInject = ({
  jsenvFileSelector,
  canUseScriptTypeModule,

  eventSourceClient,
  htmlSupervisor,
  toolbar,
}) => {
  const scriptInjections = []
  const scriptPropertiesFromFile = (file) => {
    return {
      ...(file.selected === "source_module" || file.selected === "dist_module"
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
      "data-injected": "",
    })
  }
  if (htmlSupervisor) {
    const htmlSupervisorSetupFile = jsenvFileSelector.select(
      htmlSupervisorSetupFiles,
    )
    scriptInjections.push({
      ...scriptPropertiesFromFile(htmlSupervisorSetupFile),
      "data-injected": "",
    })
    const htmlSupervisorFile = jsenvFileSelector.select(htmlSupervisorFiles, {
      canUseScriptTypeModule,
    })
    scriptInjections.push({
      ...scriptPropertiesFromFile(htmlSupervisorFile),
      "data-injected": "",
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
      "data-injected": "",
    })
  }
  return scriptInjections
}
