export const jsenvPluginUrlResolution = () => {
  const urlResolver = ({ parentUrl, specifier }) => {
    return new URL(specifier, parentUrl).href
  }
  return {
    name: "jsenv:url_resolution",
    appliesDuring: "*",
    resolve: {
      "entry_point": urlResolver,
      "js_import_export": urlResolver,
      "link_href": urlResolver,
      "script_src": urlResolver,
      "a_href": urlResolver,
      "iframe_src": urlResolver,
      "img_src": urlResolver,
      "img_srcset": urlResolver,
      "source_src": urlResolver,
      "source_srcset": urlResolver,
      "image_href": urlResolver,
      "use_href": urlResolver,
      "css_@import": urlResolver,
      "css_url": urlResolver,
      "sourcemap_comment": urlResolver,
      "js_import_meta_url_pattern": urlResolver,
    },
  }
}
