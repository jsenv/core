import "systemjs/dist/system.js"
import { getNamespaceToRegister } from "../../getNamespaceToRegister.js"

export const createBrowserSystem = ({ fetchModuleSource }) => {
  const browserSystem = new window.System.constructor()

  browserSystem.instantiate = (url, parent) => {
    return fetchModuleSource(url, parent).then(({ instantiate, type }) => {
      try {
        const value = instantiate()

        if (type === "js") {
          return browserSystem.getRegister()
        }
        if (type === "json") {
          return getNamespaceToRegister(() => {
            return {
              default: value,
            }
          })
        }
        return null
      } catch (error) {
        return Promise.reject({
          code: "MODULE_INSTANTIATE_ERROR",
          error,
          url,
          parent,
        })
      }
    })
  }

  return browserSystem
}
