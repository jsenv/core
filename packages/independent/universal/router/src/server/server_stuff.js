import { readdirSync, readFileSync } from "node:fs";
import { routeMatchUrl } from "./route_match_url.js";

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
    handleRequest: {
      GET: async (request) => {
        const getAllMatch = routeMatchUrl("/json_files", request.url);
        if (getAllMatch) {
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
        }
        const getOneMatch = routeMatchUrl("/json_files/:id", request.url);
        if (getOneMatch) {
          const { id } = getOneMatch;
          const jsonFileUrl = new URL(`./${id}.json`, jsonDirectoryUrl);
          try {
            const json = readFileSync(jsonFileUrl);
            const body = JSON.stringify(json);
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
        }
        return null;
      },
      POST: async () => {
        // TODO
      },
    },
  };
};
