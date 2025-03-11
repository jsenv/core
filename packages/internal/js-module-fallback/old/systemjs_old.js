// const { clientRuntimeCompat, isSupportedOnCurrentClient } = context
// const shouldBeCompatibleWithNode =
//   Object.keys(clientRuntimeCompat).includes("node")
// const requiredFeatureNames = [
//   "import_dynamic",
//   "top_level_await",
//   "global_this",
//   // when using node we assume the code won't use browser specific feature
//   ...(shouldBeCompatibleWithNode
//     ? []
//     : [
//         "script_type_module",
//         "worker_type_module",
//         "import_type_json",
//         "import_type_css",
//       ]),
//   // "importmap",
// ]
// const needsSystemJs = featuresRelatedToSystemJs.some((featureName) => {
//   const isRequired = requiredFeatureNames.includes(featureName)
//   return isRequired && !isSupportedOnCurrentClient(featureName)
// })
// if (!needsSystemJs) {
//   return null
// }
// const { code, map } = await applyBabelPlugins({

// })
// return {
//   content: code,
//   soourcemap: map,
// }

// const featuresRelatedToSystemJs = [
//   "script_type_module",
//   "worker_type_module",
//   "import_dynamic",
//   "import_type_json",
//   "import_type_css",
//   "top_level_await",
//   // "importmap",
//   // "worker_importmap",
// ]
