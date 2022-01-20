import { ensureGithubReleaseForPackage } from "@jsenv/github-release-package"

await ensureGithubReleaseForPackage({
  projectDirectoryUrl: new URL("../../../", import.meta.url),
})
