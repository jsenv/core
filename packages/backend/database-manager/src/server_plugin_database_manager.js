import { serverPluginDatabaseManagerSpa } from "./server_plugin_database_manager_spa.js";
import { serverPluginDatabaseRestApi } from "./server_plugin_database_rest_api.js";

export const serverPluginDatabaseManager = ({
  pathname = "/.internal/database/",
  sourceDirectoryUrl,
} = {}) => {
  return [
    serverPluginDatabaseRestApi({ pathname }),
    serverPluginDatabaseManagerSpa({ pathname, sourceDirectoryUrl }),
    serverPluginPostgresErrorHandler(),
    serverPluginJsonParseErrorHandler(),
  ];
};

const serverPluginPostgresErrorHandler = () => {
  return {
    name: "jsenv:postgres_error_handler",
    // postgress error handler
    handleError: (e) => {
      if (!e || e.name !== "PostgresError") {
        return null;
      }
      let message = e.message;
      if (e.detail) {
        message += ` (${e.detail})`;
      }
      const errorData = {
        ...e,
        message,
      };
      if (e.code === "2BP01" || e.code === "42710") {
        return Response.json(errorData, {
          status: 409,
          statusText: message.replace(/\n/g, ""),
        });
      }
      if (e.code === "42704") {
        return Response.json(errorData, {
          status: 404,
          statusText: message,
        });
      }
      return Response.json(errorData, {
        status: 500,
        statusText: message,
      });
    },
  };
};
const serverPluginJsonParseErrorHandler = () => {
  return {
    name: "uncaught_json_parse_error_handler",
    handleError: (e) => {
      // we assume the error originates from client here
      // but if some JSON.parse fails on the server application code unrelated to the client
      // we would also return 400 while it should be 500
      // ideally every JSON.parse related to the client should be catched
      if (
        e.name === "SyntaxError" &&
        e.message === "Unexpected end of JSON input"
      ) {
        return new Response(null, {
          status: 400,
          statusText: "Invalid JSON input",
        });
      }
      return null;
    },
  };
};
