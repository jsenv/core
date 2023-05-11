/*
 * This file is the first file executed by code using the package
 * Its responsability is to export what is documented
 * Ideally this file should be kept simple to help discovering codebase progressively.
 */

export { startServer } from "./start_server.js";
export { setupRoutes } from "./service_composition/routing.js";
export { readRequestBody } from "./readRequestBody.js";
export { fetchFileSystem } from "./fetch_filesystem.js";
export {
  STOP_REASON_INTERNAL_ERROR,
  STOP_REASON_PROCESS_SIGHUP,
  STOP_REASON_PROCESS_SIGTERM,
  STOP_REASON_PROCESS_SIGINT,
  STOP_REASON_PROCESS_BEFORE_EXIT,
  STOP_REASON_PROCESS_EXIT,
  STOP_REASON_NOT_SPECIFIED,
} from "./stopReasons.js";
export { jsenvServiceErrorHandler } from "./services/error_handler/jsenv_service_error_handler.js";

// CORS
export {
  jsenvServiceCORS,
  jsenvAccessControlAllowedHeaders,
  jsenvAccessControlAllowedMethods,
} from "./services/cors/jsenv_service_cors.js";

// server timing
export { timeFunction, timeStart } from "./server_timing/timing_measure.js";

// SSE
export { createSSERoom } from "./sse/sse_room.js";

// content-negotiation
export { pickContentType } from "./content_negotiation/pick_content_type.js";
export { pickContentEncoding } from "./content_negotiation/pick_content_encoding.js";
export { pickContentLanguage } from "./content_negotiation/pick_content_language.js";
export { jsenvServiceResponseAcceptanceCheck } from "./services/response_acceptance_check/jsenv_service_response_acceptance_check.js";

// others
export { serveDirectory } from "./serve_directory.js";
export { fromFetchResponse } from "./from_fetch_response.js";
export { composeTwoResponses } from "./internal/response_composition.js";
export { jsenvServiceRequestAliases } from "./services/request_aliases/jsenv_service_request_aliases.js";
export { findFreePort } from "./internal/listen.js";
