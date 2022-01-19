import { publishPackage } from "@jsenv/package-publish"

await publishPackage({
  projectDirectoryUrl: new URL("../../../", import.meta.url),
  registriesConfig: {
    "https://registry.npmjs.org": {
      token: process.env.NPM_TOKEN,
    },
  },
})

await publishPackage({
  projectDirectoryUrl: new URL(
    "../../../packages/jsenv-babel-preset",
    import.meta.url,
  ),
  registriesConfig: {
    "https://registry.npmjs.org": {
      token: process.env.NPM_TOKEN,
    },
  },
})

await publishPackage({
  projectDirectoryUrl: new URL(
    "../../../packages/jsenv-integrity",
    import.meta.url,
  ),
  registriesConfig: {
    "https://registry.npmjs.org": {
      token: process.env.NPM_TOKEN,
    },
  },
})

// await publishPackage({
//   projectDirectoryUrl: new URL("../../../packages/jsenv-vue", import.meta.url),
//   registriesConfig: {
//     "https://registry.npmjs.org": {
//       token: process.env.NPM_TOKEN,
//     },
//   },
// })
