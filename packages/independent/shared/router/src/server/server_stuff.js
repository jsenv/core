import { readdirSync, readFileSync, writeFileSync } from "node:fs";

export const clientControlledResourceService = () => {
  let resolve;
  return {
    handleRequest: {
      "GET /__delayed__.js": async () => {
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
      "POST /__delayed__.js": async () => {
        if (resolve) {
          resolve();
        }
        return {
          status: 200,
        };
      },
    },
  };
};

const jsonDirectoryUrl = new URL("./git_ignored/", import.meta.url);

export const JSONFileManagerService = () => {
  return {
    handleRequest: {
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
      "PATCH /json_files/:id": {
        "multipart/form-data": async (request, { id }) => {
          const { fields } = await request.formData();
          // TODO: attention le format form-data fait que key:value devient key: [value]
          // donc on peut pas juste faire ça, mais bon pour l'instant c'est good
          const jsonFileUrl = new URL(`./${id}`, jsonDirectoryUrl);
          const jsonFileContentAsString = readFileSync(jsonFileUrl, "utf8");
          const jsonFileContentAsObject = JSON.parse(jsonFileContentAsString);
          Object.assign(jsonFileContentAsObject, fields);
          const body = JSON.stringify(jsonFileContentAsObject);
          writeFileSync(jsonFileUrl, body);
          return {
            status: 200,
            headers: {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(body),
            },
            body,
          };
        },
      },
    },
  };
};
