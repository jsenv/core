import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

const relativeUrl =
  "./src/internal/dev_server/event_source_client/event_source_client.js"
const buildRelativeUrl = "./jsenv_event_source_client.js"
const sourceUrl = new URL(relativeUrl, jsenvCoreDirectoryUrl).href
const buildUrl = new URL(
  "./dist/jsenv_event_source_client.js",
  jsenvCoreDirectoryUrl,
)

export const eventSourceClientFileInfo = {
  relativeUrl,
  buildRelativeUrl,
  sourceUrl,
  buildUrl,
}
