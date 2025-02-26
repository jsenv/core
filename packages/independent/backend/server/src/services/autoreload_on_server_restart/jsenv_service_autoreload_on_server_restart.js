import { readFileSync } from "node:fs";

const autoreloadOnServerRestartClientFileUrl = import.meta.resolve(
  "./client/autoreload_on_server_restart.js",
);

export const jsenvServiceAutoreloadOnRestart = () => {
  return {
    name: "jsenv:autoreload_on_server_restart",

    routes: [
      {
        endpoint: "GET /jsenv_autoreload_on_server_restart.js",
        availableContentTypes: ["text/javascript"],
        hidden: true,
        response: () => {
          const jsFileContent = readFileSync(
            new URL(autoreloadOnServerRestartClientFileUrl),
            "utf8",
          );
          return new Response(jsFileContent, {
            headers: {
              "content-type": "text/javascript",
            },
          });
        },
      },
    ],
  };
};
