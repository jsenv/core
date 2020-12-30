import { createDetailedMessage } from "@jsenv/logger"

export const validateResponseStatusIsOk = async (response, importer) => {
  const { status, url } = response

  if (status === 404) {
    return {
      valid: false,
      message: createDetailedMessage(`Error: got 404 on url.`, {
        url,
        ["imported by"]: importer,
      }),
    }
  }

  if (status === 500) {
    if (response.headers["content-type"] === "application/json") {
      return {
        valid: false,
        message: createDetailedMessage(`Error: error on url.`, {
          url,
          "imported by": importer,
          "parse error": JSON.stringify(await response.json(), null, "  "),
        }),
      }
    }
  }

  if (responseStatusIsOk(status)) {
    return { valid: true }
  }

  return {
    valid: false,
    message: createDetailedMessage(`unexpected response status.`, {
      ["response status"]: status,
      ["expected status"]: "200 to 299",
      url,
      ["imported by"]: importer,
    }),
  }
}

const responseStatusIsOk = (responseStatus) => responseStatus >= 200 && responseStatus < 300
