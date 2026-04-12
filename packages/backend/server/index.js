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
} from "./src/stop_reasons.js";
export { serverPluginErrorHandler } from "./src/plugins/error_handler/server_plugin_error_handler.js";

// webSocket
export { WebSocketResponse } from "./src/web_socket_response.js";
// long polling
export { ProgressiveResponse } from "./src/progressive_response.js";
// Server event (can be used to push events to clients that can be connected with WebSocket or EventSource)
export { ServerEvents, LazyServerEvents } from "./src/server_events.js";

// CORS
export {
  serverPluginCORS,
  jsenvAccessControlAllowedHeaders,
  jsenvAccessControlAllowedMethods,
} from "./src/plugins/cors/server_plugin_cors.js";

// filesystem
export {
  createFileSystemFetch,
  fetchFileSystem,
} from "./src/plugins/filesystem/fetch_file.js";
export { fetchDirectory } from "./src/plugins/filesystem/fetch_directory.js";

// content-negotiation
export { pickContentType } from "./src/content_negotiation/pick_content_type.js";
export { pickContentEncoding } from "./src/content_negotiation/pick_content_encoding.js";
export { pickContentLanguage } from "./src/content_negotiation/pick_content_language.js";
export { serverPluginResponseAcceptanceCheck } from "./src/plugins/response_acceptance_check/server_plugin_response_acceptance_check.js";

// others
export { composeTwoResponses } from "./src/internal/response_composition.js";
export { serverPluginRequestAliases } from "./src/plugins/request_aliases/server_plugin_request_aliases.js";
export { findFreePort } from "./src/internal/listen.js";

// internal (used by @jsenv/core)
export { createPluginsController } from "./src/plugins_controller.js";
