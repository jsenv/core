import { urlToFileSystemPath } from "@jsenv/filesystem"

export const applyPostCss = async ({
  sourcemaps = "comment",
  plugins,
  // https://github.com/postcss/postcss#options
  options = {},
  url,
  map,
  content,
}) => {
  const { default: postcss } = await import("postcss")

  try {
    const cssFileUrl = urlToFileUrl(url)
    const result = await postcss(plugins).process(content, {
      collectUrls: true,
      from: urlToFileSystemPath(cssFileUrl),
      to: urlToFileSystemPath(cssFileUrl),
      map: {
        annotation: sourcemaps === "file",
        inline: sourcemaps === "inline",
        // https://postcss.org/api/#sourcemapoptions
        ...(map ? { prev: JSON.stringify(map) } : {}),
      },
      ...options,
    })
    return {
      postCssMessages: result.messages,
      map: result.map.toJSON(),
      content: result.css,
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
  const urlString = String(url)
  if (urlString.startsWith("file:")) {
    return urlString
  }
  const origin = new URL(url).origin
  const afterOrigin = urlString.slice(origin.length)
  return new URL(afterOrigin, filesystemRootUrl).href
}
