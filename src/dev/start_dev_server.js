import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem"

import { startOmegaServer } from "@jsenv/core/src/omega/server.js"

export const startDevServer = async ({
  port,
  protocol,
  certificate,
  privateKey,

  projectDirectoryUrl,
  plugins = [],
}) => {
  projectDirectoryUrl = assertAndNormalizeDirectoryUrl(projectDirectoryUrl)
  const server = await startOmegaServer({
    keepProcessAlive: true,
    port,
    protocol,
    certificate,
    privateKey,
    projectDirectoryUrl,
    plugins,
    scenario: "dev",
  })
  return server
}
