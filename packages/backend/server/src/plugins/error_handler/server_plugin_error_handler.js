import { errorToHTML } from "@jsenv/humanize";
import { readFileSync } from "node:fs";
import { pickContentType } from "../../content_negotiation/pick_content_type.js";
import { replacePlaceholdersInHtml } from "../../replace_placeholder_in_html.js";

const internalErrorHtmlFileUrl = import.meta.resolve("./client/500.html");
let internalErrorHtmlTemplate;
const readInternalErrorHtmlTemplate = () => {
  if (internalErrorHtmlTemplate === undefined) {
    internalErrorHtmlTemplate = readFileSync(
      new URL(internalErrorHtmlFileUrl),
      "utf8",
    );
  }
  return internalErrorHtmlTemplate;
};

/**
 * Server plugin turning an error thrown while handling a request into a 500
 * response (html, text or json depending on what the request accepts).
 * Without a plugin handling errors, a route that throws makes the process
 * exit. Put it last: it catches every error, so plugins handling a subset of
 * them must come before. (An error exposing `asResponse()` never reaches it:
 * the server answers it directly.)
 *
 * @param {Object} [params]
 * @param {boolean} [params.sendErrorDetails=false] - Put the error stack (and
 *   its own properties for json) in the response. Development only: a stack
 *   reveals file paths and code.
 */
export const serverPluginErrorHandler = ({ sendErrorDetails = false } = {}) => {
  return {
    name: "jsenv:error_handler",
    handleError: (serverInternalError, { request }) => {
      const serverInternalErrorIsAPrimitive =
        serverInternalError === null ||
        (typeof serverInternalError !== "object" &&
          typeof serverInternalError !== "function");
      const dataToSend = serverInternalErrorIsAPrimitive
        ? {
            code: "VALUE_THROWED",
            value: serverInternalError,
          }
        : {
            code: serverInternalError.code || "UNKNOWN_ERROR",
            ...(sendErrorDetails
              ? {
                  stack: serverInternalError.stack,
                  ...serverInternalError,
                }
              : {}),
          };

      const availableContentTypes = {
        "text/html": () => {
          const renderHtmlForErrorWithoutDetails = () => {
            return `<p>Details not available: to enable them use serverPluginErrorHandler({ sendErrorDetails: true }).</p>`;
          };
          const renderHtmlForErrorWithDetails = () => {
            return errorToHTML(serverInternalError);
          };

          const internalErrorHtml = replacePlaceholdersInHtml(
            readInternalErrorHtmlTemplate(),
            {
              errorMessage: serverInternalErrorIsAPrimitive
                ? `Code inside server has thrown a literal.`
                : `Code inside server has thrown an error.`,
              errorDetailsContent: sendErrorDetails
                ? renderHtmlForErrorWithDetails()
                : renderHtmlForErrorWithoutDetails(),
            },
          );

          return {
            headers: {
              "content-type": "text/html",
              "content-length": Buffer.byteLength(internalErrorHtml),
            },
            body: internalErrorHtml,
          };
        },
        "text/plain": () => {
          let internalErrorMessage = serverInternalErrorIsAPrimitive
            ? `Code inside server has thrown a literal:`
            : `Code inside server has thrown an error:`;
          if (sendErrorDetails) {
            if (serverInternalErrorIsAPrimitive) {
              internalErrorMessage += `\n${JSON.stringify(
                serverInternalError,
                null,
                "  ",
              )}`;
            } else {
              internalErrorMessage += `\n${serverInternalError.stack}`;
            }
          } else {
            internalErrorMessage += `\nDetails not available: to enable them use serverPluginErrorHandler({ sendErrorDetails: true }).`;
          }

          return {
            headers: {
              "content-type": "text/plain",
              "content-length": Buffer.byteLength(internalErrorMessage),
            },
            body: internalErrorMessage,
          };
        },
        "application/json": () => {
          const body = JSON.stringify(dataToSend);
          return {
            headers: {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(body),
            },
            body,
          };
        },
      };
      const bestContentType = pickContentType(
        request,
        Object.keys(availableContentTypes),
      );
      return availableContentTypes[bestContentType || "application/json"]();
    },
  };
};
