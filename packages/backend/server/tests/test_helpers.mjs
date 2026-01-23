import { snapshotTests } from "@jsenv/snapshot";
import { request } from "node:http";

export const snapshotServerTests = async (
  testFileUrl,
  fnRegisteringTests,
  options = {},
) =>
  snapshotTests(testFileUrl, fnRegisteringTests, {
    ...options,
    logEffects:
      options.logEffects === false
        ? false
        : {
            prevent: true,
            level: "warn",
            ...(options.logEffects === true ? {} : options.logEffects),
          },
  });

export const fetchUsingNodeBuiltin = async (
  url,
  { method = "GET", headers = {}, body, path } = {},
) => {
  const urlObject = new URL(url);
  const { port, hostname } = urlObject;

  const nodeRequest = request({
    hostname,
    port,
    method,
    headers: {
      ...(body ? { "content-length": Buffer.byteLength(body) } : {}),
      ...headers,
    },
    path: path || urlObject.pathname,
  });
  if (body) {
    nodeRequest.write(body);
  }
  nodeRequest.end();

  let responseBodyBufferPromise;
  const nodeResponse = await new Promise((resolve, reject) => {
    nodeRequest.on("error", (error) => {
      console.error(`error event triggered on request to ${url}`);
      reject(error);
    });
    nodeRequest.on("response", (nodeResponse) => {
      responseBodyBufferPromise = new Promise((resolve, reject) => {
        const bufferArray = [];
        nodeResponse.on("error", (e) => {
          reject(e);
        });
        nodeResponse.on("data", (chunk) => {
          bufferArray.push(chunk);
        });
        nodeResponse.on("end", () => {
          const bodyBuffer = Buffer.concat(bufferArray);
          resolve(bodyBuffer);
        });
      });
      resolve(nodeResponse);
    });
  });

  return {
    url,
    status: nodeResponse.statusCode,
    statusText: nodeResponse.statusText,
    headers: new Map(Object.entries(nodeResponse.headers)),
    text: async () => {
      const responseBodyBuffer = await responseBodyBufferPromise;
      return responseBodyBuffer.toString();
    },
  };
};

export const sendGlobalOptionsHttpRequest = async (url) => {
  return fetchUsingNodeBuiltin(url, {
    method: "OPTIONS",
  });
};
