import { publishPackage } from "@jsenv/package-publish"

await publishPackage({
  projectDirectoryUrl: new URL("../../", import.meta.url),
  registriesConfig: {
    "https://registry.npmjs.org": {
      token: process.env.NPM_TOKEN,
    },
    "https://npm.pkg.github.com": {
      token: process.env.GITHUB_TOKEN,
    },
  },
})

await publishPackage({
  projectDirectoryUrl: new URL("../../packages/jsenv-sass", import.meta.url),
  logLevel: "debug",
  registriesConfig: {
    "https://registry.npmjs.org": {
      token: process.env.NPM_TOKEN,
    },
    "https://npm.pkg.github.com": {
      token: process.env.GITHUB_TOKEN,
    },
  },
})

await publishPackage({
  projectDirectoryUrl: new URL("../../packages/jsenv-vue", import.meta.url),
  registriesConfig: {
    "https://registry.npmjs.org": {
      token: process.env.NPM_TOKEN,
    },
    "https://npm.pkg.github.com": {
      token: process.env.GITHUB_TOKEN,
    },
  },
})
