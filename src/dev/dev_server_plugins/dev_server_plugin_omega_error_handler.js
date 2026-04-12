import { serverPluginErrorHandler } from "@jsenv/server";
import { convertFileSystemErrorToResponseProperties } from "@jsenv/server/src/plugins/filesystem/filesystem_error_to_response.js";

export const devServerPluginOmegaErrorHandler = () => {
  return [
    {
      name: "jsenv:omega_error_handler",
      handleError: (error) => {
        const getResponseForError = () => {
          if (error && error.asResponse) {
            return error.asResponse();
          }
          if (error && error.statusText === "Unexpected directory operation") {
            return {
              status: 403,
            };
          }
          return convertFileSystemErrorToResponseProperties(error);
        };
        const response = getResponseForError();
        if (!response) {
          return null;
        }
        const body = JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          body: response.body,
        });
        return {
          status: response.status,
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(body),
          },
          body,
        };
      },
    },
    serverPluginErrorHandler({
      sendErrorDetails: true,
    }),
  ];
};
