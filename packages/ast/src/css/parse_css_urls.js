import { applyPostCss } from "./apply_post_css.js"
import { postCssPluginUrlVisitor } from "./postcss_plugin_url_visitor.js"

export const parseCssUrls = async ({ css, url }) => {
  const cssUrls = []
  await applyPostCss({
    content: css,
    url,
    sourcemaps: false,
    plugins: [
      postCssPluginUrlVisitor({
        urlVisitor: ({
          type,
          specifier,
          specifierStart,
          specifierEnd,
          specifierLine,
          specifierColumn,
        }) => {
          cssUrls.push({
            type: `css_${type}`,
            specifier,
            start: specifierStart,
            end: specifierEnd,
            line: specifierLine,
            column: specifierColumn,
          })
        },
      }),
    ],
  })
  return cssUrls
}
