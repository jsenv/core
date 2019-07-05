export const rejectionValueToMeta = (error) => {
  if (error && error.code === "MODULE_PARSING_ERROR") {
    const { parsingError } = error

    return {
      href: parsingError.href,
      importerHref: error.importerHref,
      error: parsingError.messageHMTL || parsingError.message,
      dataTheme: "light",
    }
  }

  if (error && error.code === "MODULE_INSTANTIATION_ERROR") {
    const { instantiationError } = error

    return {
      href: error.href,
      importerHref: error.importerHref,
      error: instantiationError,
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
