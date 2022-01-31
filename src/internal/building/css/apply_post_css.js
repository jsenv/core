import { urlToFileSystemPath } from "@jsenv/filesystem"

export const applyPostCss = async ({
  code,
  url,
  map,
  sourcemapMethod = "comment",
  plugins,
  // https://github.com/postcss/postcss#options
  options = {},
}) => {
  const { default: postcss } = await import("postcss")

  try {
    const cssFileUrl = urlToFileUrl(url)
    const result = await postcss(plugins).process(code, {
      collectUrls: true,
      from: urlToFileSystemPath(cssFileUrl),
      to: urlToFileSystemPath(cssFileUrl),
      map: {
        annotation: sourcemapMethod === "comment",
        inline: sourcemapMethod === "inline",
        // https://postcss.org/api/#sourcemapoptions
        ...(map ? { prev: JSON.stringify(map) } : {}),
      },
      ...options,
    })
    return {
      code: result.css,
      map: result.map.toJSON(),
      postCssMessages: result.messages,
    }
  } catch (error) {
    if (error.name === "CssSyntaxError") {
      console.error(String(error))
      throw error
    }
    throw error
  }
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
