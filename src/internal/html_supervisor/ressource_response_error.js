import { createDetailedMessage } from "@jsenv/core/node_modules/@jsenv/logger/main.browser.js"

import { getRessourceTrace } from "../url_context.js"

export const getRessourceResponseError = async ({
  urlContext,
  contentTypeExpected,
  type,
  url,
  importerUrl,
  response,
}) => {
  if (response.status === 404) {
    return new Error(
      createDetailedMessage("file cannot be found", {
        ...getRessourceTrace({
          urlContext,
          url,
          importerUrl,
          type,
          notFound: true,
        }),
      }),
    )
  }
  const contentType = response.headers["content-type"] || ""
  if (response.status === 500 && contentType === "application/json") {
    const bodyAsJson = await response.json()
    if (bodyAsJson.code === "PARSE_ERROR") {
      const error = new Error(
        createDetailedMessage("file cannot be parsed", {
          "parsing error message": bodyAsJson.message,
          ...getRessourceTrace({
            urlContext,
            url,
            importerUrl,
            type,
          }),
        }),
      )
      error.cause = bodyAsJson
      return error
    }
  }
  if (response.status < 200 || response.status >= 300) {
    return new Error(
      createDetailedMessage("file response status is unexpected", {
        "status": response.status,
        "allowed status": "200 to 299",
        "statusText": response.statusText,
        ...getRessourceTrace({
          urlContext,
          url,
          importerUrl,
          type,
        }),
      }),
    )
  }
  if (contentType !== contentTypeExpected) {
    return new Error(
      createDetailedMessage(
        `Failed to load ressource: Expected "${contentTypeExpected}" MIME type but the server responded with a MIME type of "${contentType}"`,
        {
          ...getRessourceTrace({
            urlContext,
            url,
            importerUrl,
            type,
          }),
          ...(contentTypeExpected === "application/javascript" &&
          type === "js_module"
            ? {
                suggestion: `Use import.meta.url or import assertions as documented in https://github.com/jsenv/jsenv-core/blob/master/docs/assets/readme.md`,
              }
            : {}),
        },
      ),
    )
  }
  return null
}
