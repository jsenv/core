import { createBrowserSystem } from "./system/createBrowserSystem.js"

export const createExecuteFile = ({ fetchModule }) => {
  const browserSystem = createBrowserSystem(fetchModule)
  window.System = browserSystem
  return (file) => {
    return browserSystem.import(file)
  }
}
