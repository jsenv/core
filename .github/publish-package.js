import { publishPackage } from "@jsenv/package-publish"
import { projectDirectoryUrl } from "../jsenv.config.js"

// eslint-disable-next-line import/newline-after-import
;(async () => {
  Object.assign(
    process.env,
    await import("../secrets.json").then(
      (namespace) => namespace.default,
      () => {},
    ),
  )

  publishPackage({
    projectDirectoryUrl,
    registriesConfig: {
      "https://registry.npmjs.org": {
        token: process.env.NPM_TOKEN,
      },
      "https://npm.pkg.github.com": {
        token: process.env.GITHUB_TOKEN,
      },
    },
  })
})()
