import { applyBabelPlugins } from "./apply_babel_plugins.js"

export const parseJsString = async ({ url, content }) => {
  const { ast } = await applyBabelPlugins({
    url,
    content,
    options: { ast: true },
  })
  return ast
}
