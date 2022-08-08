export const jsenvPluginUrlResolution = () => {
  const urlResolver = (reference) => {
    return new URL(
      reference.specifier,
      reference.baseUrl || reference.parentUrl,
    ).href
  }
  return {
    name: "jsenv:url_resolution",
    appliesDuring: "*",
    resolveUrl: {
      "http_request": urlResolver, // during dev
      "entry_point": urlResolver, // during build
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
      "js_import_export": urlResolver,
      "js_url_specifier": urlResolver,
      "js_inline_content": urlResolver,
      "webmanifest_icon_src": urlResolver,
      "programmatic_package_json": urlResolver,
    },
  }
}
