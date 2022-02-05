import { setupRoutes } from "@jsenv/server"

import { redirectorFiles } from "@jsenv/core/src/internal/jsenv_file_selector.js"
import { injectQuery } from "@jsenv/core/src/internal/url_utils.js"

export const createCompileRedirectorService = async ({
  jsenvFileSelector,
  mainFileRelativeUrl,
}) => {
  const redirectorFile = jsenvFileSelector.select(redirectorFiles, {
    canUseScriptTypeModule: false,
  })
  return setupRoutes({
    "/": (request) => {
      const redirectTarget = mainFileRelativeUrl
      return {
        status: 307,
        headers: {
          location: injectQuery(
            `${request.origin}${redirectorFile.urlRelativeToProject}`,
            {
              redirect: redirectTarget,
            },
          ),
        },
      }
    },
    // compile server (compiled file service to be precised)
    // is already implementing this redirection when a compile id do not exists
    // and "redirect" is not a valid compile id
    // That being said I prefer to keep it to be explicit and shortcircuit the logic
    "/.jsenv/redirect/:rest*": (request) => {
      const redirectTarget = request.ressource.slice("/.jsenv/redirect/".length)
      return {
        status: 307,
        headers: {
          location: injectQuery(
            `${request.origin}${redirectorFile.urlRelativeToProject}`,
            {
              redirect: redirectTarget,
            },
          ),
        },
      }
    },
    "/.jsenv/force/:rest*": (request) => {
      const redirectTarget = request.ressource.slice("/.jsenv/force/".length)
      return {
        status: 307,
        headers: {
          location: injectQuery(
            `${request.origin}${redirectorFile.urlRelativeToProject}`,
            {
              redirect: redirectTarget,
              force_compilation: 1,
            },
          ),
        },
      }
    },
  })
}
