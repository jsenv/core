export const jsenvPluginUrlResolution = () => {
  const urlResolver = ({ parentUrl, specifier }) => {
    return new URL(specifier, parentUrl).href
  }
  return {
    name: "jsenv:url_resolution",
    appliesDuring: "*",
    resolve: {
      "entry_point": urlResolver,
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
      "js_new_url_first_arg": urlResolver,
      "js_new_worker_first_arg": urlResolver,
      "js_service_worker_register_first_arg": urlResolver,
      "js_inline_content": urlResolver,
    },
  }
}
