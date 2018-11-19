import "systemjs/dist/system.js"
import { fetchUsingXHR } from "./fetchUsingXHR.js"
import { getNamespaceToRegister } from "../getNamespaceToRegister.js"

const browserSystem = new window.System.constructor()

browserSystem.instantiate = (url, parent) => {
  return fetchUsingXHR(url, {
    "x-module-referer": parent || url,
  }).then(({ status, headers, reason, body }) => {
    if (status < 200 || status >= 400) {
      return Promise.reject({ status, reason, headers, body })
    }

    if (headers["content-type"] === "application/javascript") {
      body = `${body}
${"//#"} sourceURL=${url}`

      try {
        window.eval(body)
      } catch (error) {
        return Promise.reject({
          code: "MODULE_INSTANTIATE_ERROR",
          error,
          url,
          parent,
        })
      }

      return browserSystem.getRegister()
    }

    if (headers["content-type"] === "application/json") {
      return getNamespaceToRegister(() => {
        return {
          default: JSON.parse(body),
        }
      })
    }

    return null
  })
}

window.System = browserSystem
