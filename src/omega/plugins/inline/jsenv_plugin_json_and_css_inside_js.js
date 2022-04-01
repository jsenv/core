export const jsenvPluginJsonAndCssInsideJs = () => {
  return {
    name: "jsenv:json_and_css_inside_js",
    appliesDuring: "*",
    transform: {
      js_module: () => {},
    },
  }
}

// const babelPluginMetadataInlineJsonAndCss = () => {
//   return {}
// }
