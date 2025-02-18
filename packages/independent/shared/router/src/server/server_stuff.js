import { readRequestBody } from "@jsenv/server";
import { readdirSync, readFileSync } from "node:fs";
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
        const jsonFileUrl = new URL(`./${id}`, jsonDirectoryUrl);
        const { fields } = await readRequestBody(request);
        debugger;
      },
    }),
  };
};
