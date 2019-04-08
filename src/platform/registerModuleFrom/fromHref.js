import { createModuleNotFoundError } from "./error/module-not-found-error.js"
import { createModuleParseError } from "./error/module-parse-error.js"
import { createModuleResponseUnsupportedStatusError } from "./error/module-response-unsupported-status-error.js"
import { createModuleResponseMissingContentTypeHeaderError } from "./error/module-response-missing-content-type-header-error.js"
import { createModuleResponseUnsupportedContentTypeHeaderError } from "./error/module-response-unsupported-content-type-header-error.js"
import { fromFunctionReturningRegisteredModule } from "./fromFunctionReturningRegisteredModule.js"
import { fromFunctionReturningNamespace } from "./fromFunctionReturningNamespace.js"

export const fromHref = async ({ href, importerHref, fetchSource, instantiateJavaScript }) => {
  const { url, status, statusText, headers, body } = await fetchSource({
    href,
    importerHref,
  })
  const realHref = url

  if (status === 404) {
    throw createModuleNotFoundError({
      href: realHref,
      importerHref,
    })
  }

  if (status === 500 && statusText === "parse error") {
    throw createModuleParseError({ href: realHref, importerHref, parseError: JSON.parse(body) })
  }

  if (status < 200 || status >= 300) {
    throw createModuleResponseUnsupportedStatusError({
      href: realHref,
      importerHref,
      status,
      statusText,
    })
  }

  if ("content-type" in headers === false) {
    throw createModuleResponseMissingContentTypeHeaderError({
      href: realHref,
      importerHref,
    })
  }

  const contentType = headers["content-type"]

  if (contentType === "application/javascript") {
    return fromFunctionReturningRegisteredModule(() => instantiateJavaScript(body, realHref), {
      href: realHref,
      importerHref,
    })
  }

  if (contentType === "application/json") {
    return fromFunctionReturningNamespace(
      () => {
        return {
          default: JSON.parse(body),
        }
      },
      { href: realHref, importerHref },
    )
  }

  throw createModuleResponseUnsupportedContentTypeHeaderError({
    href: realHref,
    importerHref,
    contentType,
  })
}
