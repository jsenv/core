import { publishPackage } from "@jsenv/package-publish"

const rootDirectoryUrl = new URL("../../../", import.meta.url)

await ["jsenv-babel-preset", "jsenv-integrity"].reduce(
  async (previous, packageName) => {
    await previous
    await publishPackage({
      projectDirectoryUrl: new URL(
        `./packages/${packageName}`,
        rootDirectoryUrl,
      ),
      registriesConfig: {
        "https://registry.npmjs.org": {
          token: process.env.NPM_TOKEN,
        },
      },
    })
  },
  Promise.resolve(),
)
await publishPackage({
  projectDirectoryUrl: rootDirectoryUrl,
  registriesConfig: {
    "https://registry.npmjs.org": {
      token: process.env.NPM_TOKEN,
    },
  },
})
