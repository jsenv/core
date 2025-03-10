import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";
import { readFileSync } from "node:fs";

const jsenvServerRootDirectoryUrl = import.meta.build
  ? ""
  : import.meta.resolve("../../../");

export const jsenvServiceInternalClientFiles = () => {
  return {
    name: "jsenv:internal_client_files",

    routes: [
      {
        endpoint: "GET /@jsenv/server/*",
        description: "Serve @jsenv/server internal files.",
        availableMediaTypes: ["text/javascript"],
        declarationSource: import.meta.url,
        fetch: (request) => {
          const path = request.params[0];
          const jsenvServerClientFileUrl = new URL(
            `./${path}`,
            jsenvServerRootDirectoryUrl,
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
