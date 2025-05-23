import { removeFileSync, writeFileSync } from "@jsenv/filesystem";
import { existsSync, readdirSync, readFileSync } from "node:fs";

export const jsenvPluginControlledResource = () => {
  let resolve;
  return {
    devServerRoutes: [
      {
        endpoint: "GET /__delayed__.js",
        fetch: async () => {
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
        },
      },
      {
        endpoint: "POST /__delayed__.js",
        fetch: async () => {
          if (resolve) {
            resolve();
          }
          return {
            status: 200,
          };
        },
      },
    ],
  };
};

const jsonDirectoryUrl = new URL("./git_ignored/", import.meta.url);

export const jsenvPluginJSONFileManager = () => {
  return {
    devServerRoutes: [
      {
        endpoint: "GET /json_files",
        fetch: () => {
          try {
            const jsonFiles = readdirSync(jsonDirectoryUrl);
            return Response.json(jsonFiles);
          } catch (e) {
            if (e.code === "ENOENT") {
              return Response.json([]);
            }
            throw e;
          }
        },
      },
      {
        endpoint: "GET /json_files/:id",
        fetch: (request) => {
          const { id } = request.params;
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
      },
      {
        endpoint: "POST /json_files/:id",
        fetch: async (request) => {
          const { id } = request.params;
          const jsonFileUrl = new URL(`./${id}`, jsonDirectoryUrl);
          if (existsSync(jsonFileUrl)) {
            return { status: 409 };
          }
          const jsonFileContent = await request.buffer();
          writeFileSync(jsonFileUrl, jsonFileContent);
          return new Response(jsonFileContent, { status: 201 });
        },
      },
      {
        endpoint: "PATCH /json_files/:id",
        acceptedMediaTypes: ["multipart/form-data"],
        fetch: async (request, { id }) => {
          const { fields } = await request.formData();
          // TODO: attention le format form-data fait que key:value devient key: [value]
          // donc on peut pas juste faire ça, mais bon pour l'instant c'est good
          const jsonFileUrl = new URL(`./${id}`, jsonDirectoryUrl);
          const jsonFileContentAsString = readFileSync(jsonFileUrl, "utf8");
          const jsonFileContentAsObject = JSON.parse(jsonFileContentAsString);
          Object.assign(jsonFileContentAsObject, fields);
          const body = JSON.stringify(jsonFileContentAsObject);
          writeFileSync(jsonFileUrl, body);
          return Response.json(body);
        },
      },
      {
        endpoint: "DELETE /json_files/:id",
        fetch: async (request) => {
          const { id } = request.params;
          const jsonFileUrl = new URL(`./${id}`, jsonDirectoryUrl);
          removeFileSync(jsonFileUrl, { allowUseless: true });
          return Response.json(null);
        },
      },
    ],
  };
};
