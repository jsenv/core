export const rejectionValueToMeta = (error) => {
  if (error && error.code === "MODULE_PARSE_ERROR") {
    const parseError = error.parseError

    return {
      href: parseError.href,
      importerHref: error.importerHref,
      error: parseError.messageHMTL || parseError.message,
      dataTheme: "light",
    }
  }

  if (error && error.code === "MODULE_INSTANTIATE_ERROR") {
    return {
      href: error.href,
      importerHref: error.importerHref,
      error: error.instantiateError,
    }
  }

  if (error && error.code && error.href) {
    return {
      href: error.href,
      importerHref: error.importerHref,
      error,
    }
  }

  return {
    error,
  }
}
