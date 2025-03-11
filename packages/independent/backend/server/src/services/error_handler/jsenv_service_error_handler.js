import { readFileSync } from "node:fs";
import { pickContentType } from "../../content_negotiation/pick_content_type.js";
import { replacePlaceholdersInHtml } from "../../replace_placeholder_in_html.js";

const internalErrorHtmlFileUrl = import.meta.resolve("./client/500.html");

export const jsenvServiceErrorHandler = ({ sendErrorDetails = false } = {}) => {
  return {
    name: "jsenv:error_handler",
    handleError: (serverInternalError, { request }) => {
      const serverInternalErrorIsAPrimitive =
        serverInternalError === null ||
        (typeof serverInternalError !== "object" &&
          typeof serverInternalError !== "function");
      if (!serverInternalErrorIsAPrimitive && serverInternalError.asResponse) {
        return serverInternalError.asResponse();
      }
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
            return `<p>Details not available: to enable them use jsenvServiceErrorHandler({ sendErrorDetails: true }).</p>`;
          };
          const renderHtmlForErrorWithDetails = () => {
            if (serverInternalErrorIsAPrimitive) {
              return `<pre>${JSON.stringify(
                serverInternalError,
                null,
                "  ",
              )}</pre>`;
            }
            return `<pre>${serverInternalError.stack}</pre>`;
          };

          const internalErrorHtmlTemplate = readFileSync(
            new URL(internalErrorHtmlFileUrl),
            "utf8",
          );
          const internalErrorHtml = replacePlaceholdersInHtml(
            internalErrorHtmlTemplate,
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
            internalErrorMessage += `\nDetails not available: to enable them use jsenvServiceErrorHandler({ sendErrorDetails: true }).`;
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
