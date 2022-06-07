export const urlSpecifierEncoding = {
  encode: (reference) => {
    const { generatedSpecifier } = reference
    if (generatedSpecifier.then) {
      return generatedSpecifier.then((value) => {
        reference.generatedSpecifier = value
        return urlSpecifierEncoding.encode(reference)
      })
    }
    // allow plugin to return a function to bypas default formatting
    // (which is to use JSON.stringify when url is referenced inside js)
    if (typeof generatedSpecifier === "function") {
      return generatedSpecifier()
    }
    const formatter = formatters[reference.type]
    const value = formatter
      ? formatter.encode(generatedSpecifier)
      : generatedSpecifier
    if (reference.escape) {
      return reference.escape(value)
    }
    return value
  },
  decode: (reference) => {
    const formatter = formatters[reference.type]
    return formatter
      ? formatter.decode(reference.generatedSpecifier)
      : reference.generatedSpecifier
  },
}
const formatters = {
  "js_import_export": { encode: JSON.stringify, decode: JSON.parse },
  "js_url_specifier": { encode: JSON.stringify, decode: JSON.parse },
  "css_@import": { encode: JSON.stringify, code: JSON.stringify },
  // https://github.com/webpack-contrib/css-loader/pull/627/files
  "css_url": {
    encode: (url) => {
      // If url is already wrapped in quotes, remove them
      url = formatters.css_url.decode(url)
      // Should url be wrapped?
      // See https://drafts.csswg.org/css-values-3/#urls
      if (/["'() \t\n]/.test(url)) {
        return `"${url.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`
      }
      return url
    },
    decode: (url) => {
      const firstChar = url[0]
      const lastChar = url[url.length - 1]
      if (firstChar === `"` && lastChar === `"`) {
        return url.slice(1, -1)
      }
      if (firstChar === `'` && lastChar === `'`) {
        return url.slice(1, -1)
      }
      return url
    },
  },
}
