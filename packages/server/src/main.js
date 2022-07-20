/*
 * This file is the first file executed by code using the package
 * Its responsability is to export what is documented
 * Ideally this file should be kept simple to help discovering codebase progressively.
 */

export { startServer } from "./server.js"
export { composeServices } from "./service_composition/service_composition.js"
export { setupRoutes } from "./service_composition/routing.js"
export { readRequestBody } from "./readRequestBody.js"
export { fetchFileSystem } from "./fetch_filesystem.js"
export {
  STOP_REASON_INTERNAL_ERROR,
  STOP_REASON_PROCESS_SIGHUP,
  STOP_REASON_PROCESS_SIGTERM,
  STOP_REASON_PROCESS_SIGINT,
  STOP_REASON_PROCESS_BEFORE_EXIT,
  STOP_REASON_PROCESS_EXIT,
  STOP_REASON_NOT_SPECIFIED,
} from "./stopReasons.js"

// CORS
export {
  pluginCORS,
  jsenvAccessControlAllowedHeaders,
  jsenvAccessControlAllowedMethods,
} from "./cors/plugin_cors.js"

// server timings
export { pluginServerTiming } from "./server_timing/plugin_server_timing.js"
export { timeFunction, timeStart } from "./server_timing/timing_measure.js"

// SSE
export { createSSERoom } from "./sse/sse_room.js"

// content-negotiation
export { negotiateContentType } from "./content_negotiation/negotiateContentType.js"
export { negotiateContentEncoding } from "./content_negotiation/negotiateContentEncoding.js"
export { negotiateContentLanguage } from "./content_negotiation/negotiateContentLanguage.js"
export { pluginContentNegotiationCheck } from "./content_negotiation/plugin_content_negotiation_check.js"

// others
export { serveDirectory } from "./serve_directory.js"
export { fromFetchResponse } from "./from_fetch_response.js"
export { composeTwoResponses } from "./internal/response_composition.js"
export { pluginRessourceAliases } from "./ressource_aliases/plugin_ressource_aliases.js"
export { pluginRequestWaitingCheck } from "./plugin_request_waiting_check.js"
export { findFreePort } from "./internal/listen.js"
