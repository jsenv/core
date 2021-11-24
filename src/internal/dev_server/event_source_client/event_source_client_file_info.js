import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

const sourceRelativeUrl =
  "./src/internal/dev_server/event_source_client/event_source_client.js"
const buildRelativeUrl = "./jsenv_event_source_client.js"
const sourceUrl = new URL(sourceRelativeUrl, jsenvCoreDirectoryUrl).href
const buildUrl = new URL(
  "./dist/jsenv_event_source_client.js",
  jsenvCoreDirectoryUrl,
)

export const eventSourceClientFileInfo = {
  sourceRelativeUrl,
  buildRelativeUrl,
  sourceUrl,
  buildUrl,
}
