/*
 * This file is the first file executed by code using the package
 * Its responsability is to export what is documented
 * Ideally this file should be kept simple to help discovering codebase progressively.
 */

// tslint:disable:ordered-imports

export { startServer } from "./src/start_server.js";

export {
  STOP_REASON_INTERNAL_ERROR,
  STOP_REASON_PROCESS_SIGHUP,
  STOP_REASON_PROCESS_SIGTERM,
  STOP_REASON_PROCESS_SIGINT,
  STOP_REASON_PROCESS_BEFORE_EXIT,
  STOP_REASON_PROCESS_EXIT,
  STOP_REASON_NOT_SPECIFIED,
} from "./src/stopReasons.js";
export { jsenvServiceErrorHandler } from "./src/services/error_handler/jsenv_service_error_handler.js";

// webSocket
export { WebSocketResponse } from "./src/web_socket_response.js";
// long polling
export { ProgressiveResponse } from "./src/progressive_response.js";
// Server event (can be used to push events to clients that can be connected with WebSocket or EventSource)
export { ServerEvents, LazyServerEvents } from "./src/server_events.js";

// CORS
export {
  jsenvServiceCORS,
  jsenvAccessControlAllowedHeaders,
  jsenvAccessControlAllowedMethods,
} from "./src/services/cors/jsenv_service_cors.js";

// filesystem
export {
  createFileSystemFetch,
  fetchFileSystem,
} from "./src/services/filesystem/fetch_filesystem.js";
export { serveDirectory } from "./src/services/filesystem/serve_directory.js";
export { jsenvServiceStaticFiles } from "./src/services/filesystem/jsenv_service_static_files.js";

// content-negotiation
export { pickContentType } from "./src/content_negotiation/pick_content_type.js";
export { pickContentEncoding } from "./src/content_negotiation/pick_content_encoding.js";
export { pickContentLanguage } from "./src/content_negotiation/pick_content_language.js";
export { jsenvServiceResponseAcceptanceCheck } from "./src/services/response_acceptance_check/jsenv_service_response_acceptance_check.js";

// others
export { composeTwoResponses } from "./src/internal/response_composition.js";
export { jsenvServiceRequestAliases } from "./src/services/request_aliases/jsenv_service_request_aliases.js";
export { findFreePort } from "./src/internal/listen.js";
