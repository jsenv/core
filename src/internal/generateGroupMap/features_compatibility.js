import { jsenvBabelPluginCompatMap } from "./babel_plugins_compatibility.js"

export const featuresCompatMap = {
  module: {
    edge: "16",
    firefox: "60",
    chrome: "61",
    safari: "10.1",
    opera: "48",
    ios: "10.3",
    android: "61",
    samsung: "8.2",
  },
  // https://caniuse.com/import-maps
  importmap: {
    edge: "89",
    chrome: "89",
    opera: "76",
    samsung: "15",
  },
  import_assertion_type_json: {
    chrome: "91",
    edge: "91",
  },
  import_assertion_type_css: {
    chrome: "93",
    edge: "93",
  },
  worker_type_module: {
    chrome: "80",
    edge: "80",
    opera: "67",
    android: "80",
  },
  worker_importmap: {},
  ...jsenvBabelPluginCompatMap,
}
