import { urlToFileSystemPath } from "@jsenv/filesystem"

export const applyPostCss = async (
  cssString,
  cssUrl,
  plugins,
  // https://github.com/postcss/postcss#options
  options = {},
) => {
  const { default: postcss } = await import("postcss")

  let result
  try {
    const cssFileUrl = urlToFileUrl(cssUrl)
    result = await postcss(plugins).process(cssString, {
      collectUrls: true,
      from: urlToFileSystemPath(cssFileUrl),
      to: urlToFileSystemPath(cssFileUrl),
      ...options,
    })
  } catch (error) {
    if (error.name === "CssSyntaxError") {
      console.error(String(error))
      throw error
    }
    throw error
  }
  return result
}

// the goal of this function is to take an url that is likely an http url
// info a file:// url
// for instance http://example.com/dir/file.js
// must becomes file:///dir/file.js
// but in windows it must be file://C:/dir/file.js
const filesystemRootUrl = new URL("/", import.meta.url)
const urlToFileUrl = (url) => {
  if (url.startsWith("file://")) {
    return url
  }
  const origin = new URL(url).origin
  const afterOrigin = url.slice(origin.length)
  return new URL(afterOrigin, filesystemRootUrl).href
}
