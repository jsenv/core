/*
 * This file is the first file executed by code using the package
 * Its responsability is to export what is documented
 * Ideally this file should be kept simple to help discovering codebase progressively.
 */

// tslint:disable:ordered-imports

export { startServer } from "./start_server.js";

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

// filesystem
export { createFileSystemFetch } from "./filesystem/filesystem_request_handler.js";
export { fetchFileSystem } from "./filesystem/fetch_filesystem.js";

// webSocket
export { WebSocketResponse } from "./web_socket_response.js";
// long polling
export { ProgressiveResponse } from "./progressive_response.js";
// Server event source (can be used to push events to clients that can be connected with WebSocket, EventSource or long polling)
export { SSE } from "./sse.js";

// CORS
export {
  jsenvServiceCORS,
  jsenvAccessControlAllowedHeaders,
  jsenvAccessControlAllowedMethods,
} from "./services/cors/jsenv_service_cors.js";

// content-negotiation
export { pickContentType } from "./content_negotiation/pick_content_type.js";
export { pickContentEncoding } from "./content_negotiation/pick_content_encoding.js";
export { pickContentLanguage } from "./content_negotiation/pick_content_language.js";
export { jsenvServiceResponseAcceptanceCheck } from "./services/response_acceptance_check/jsenv_service_response_acceptance_check.js";

// others
export { serveDirectory } from "./filesystem/serve_directory.js";
export { composeTwoResponses } from "./internal/response_composition.js";
export { jsenvServiceRequestAliases } from "./services/request_aliases/jsenv_service_request_aliases.js";
export { findFreePort } from "./internal/listen.js";
