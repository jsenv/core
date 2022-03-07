import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem"

import { startOmegaServer } from "@jsenv/core/src/omega/server.js"

export const startDevServer = async ({
  port,
  protocol,
  // it's better to use http1 by default because it allows to get statusText in devtools
  // which gives valuable information when there is errors
  http2 = false,
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
    http2,
    certificate,
    privateKey,
    projectDirectoryUrl,
    plugins,
    scenario: "dev",
  })
  return server
}
