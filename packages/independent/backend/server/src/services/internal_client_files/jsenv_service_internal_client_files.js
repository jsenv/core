import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";
import { readFileSync } from "node:fs";

export const jsenvServiceInternalClientFiles = () => {
  return {
    name: "jsenv:internal_client_files",

    routes: [
      {
        endpoint: "GET /@jsenv/server/*",
        availableContentTypes: ["text/javascript"],
        hidden: true,
        response: (request, path) => {
          const jsenvServerClientFileUrl = new URL(
            `./${path}`,
            import.meta.url,
          );
          const fileContent = readFileSync(jsenvServerClientFileUrl, "utf8");
          return new Response(fileContent, {
            headers: {
              "content-type": CONTENT_TYPE.fromUrlExtension(
                jsenvServerClientFileUrl,
              ),
            },
          });
        },
      },
    ],
  };
};
