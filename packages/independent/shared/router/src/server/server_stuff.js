import { handleRequestBody } from "@jsenv/server";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { routeClientRequest } from "./client_request_routing.js";

export const clientControlledResourceService = () => {
  let resolve;
  return {
    handleRequest: async (request) => {
      if (request.pathname === "/__delayed__.js") {
        if (request.method === "POST") {
          if (resolve) {
            resolve();
          }
          return {
            status: 200,
          };
        }
        if (resolve) {
          resolve();
        }
        const promise = new Promise((r) => {
          resolve = r;
        });
        await promise;
        return {
          status: 200,
          body: "",
          headers: {
            "content-length": 0,
          },
        };
      }
      return null;
    },
  };
};

const jsonDirectoryUrl = new URL("./git_ignored/", import.meta.url);

export const JSONFileManagerService = () => {
  return {
    handleRequest: routeClientRequest({
      "GET /json_files": () => {
        const jsonFiles = readdirSync(jsonDirectoryUrl);
        const body = JSON.stringify(jsonFiles);
        return {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(body),
          },
          body,
        };
      },
      "POST /json_files/": () => {},
      "GET /json_files/:id": (request, { id }) => {
        const jsonFileUrl = new URL(`./${id}`, jsonDirectoryUrl);
        try {
          const jsonBuffer = readFileSync(jsonFileUrl);
          const body = String(jsonBuffer);
          return {
            status: 200,
            headers: {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(body),
            },
            body,
          };
        } catch (e) {
          if (e.code === "ENOENT") {
            return { status: 404 };
          }
          return { status: 500 };
        }
      },
      "PATCH /json_files/:id": async (request, { id }) => {
        return handleRequestBody(request, {
          "multipart/form-data": ({ fields }) => {
            // TODO: attention le format form-data fait que key:value devient key: [value]
            // donc on peut pas juste faire ça, mais bon pour l'instant c'est good
            const jsonFileUrl = new URL(`./${id}`, jsonDirectoryUrl);
            const jsonFileContentAsString = readFileSync(jsonFileUrl, "utf8");
            const jsonFileContentAsObject = JSON.parse(jsonFileContentAsString);
            Object.assign(jsonFileContentAsObject, fields);
            writeFileSync(jsonFileUrl, fields);
            const body = JSON.stringify(jsonFileContentAsObject);
            return {
              status: 200,
              headers: {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(body),
              },
              body,
            };
          },
        });
      },
    }),
  };
};
