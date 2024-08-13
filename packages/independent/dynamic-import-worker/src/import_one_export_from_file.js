import { Worker } from "node:worker_threads";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// we use a worker to bypass node cache on dynamic import
const WORKER_COLLECTING_ONE_EXPORT_FILE_URL = new URL(
  "./worker_collecting_one_export.js",
  import.meta.url,
);

export const importOneExportFromFile = async (
  fileUrl,
  { env = process.env, params } = {},
) => {
  const { hash, urlWithoutHash } = extractHashFromUrl(fileUrl);
  if (!hash) {
    throw new Error(`no hash found in fileUrl ${fileUrl}`);
  }

  const url = urlWithoutHash;
  const exportName = hash.slice(1);

  const exists = existsSync(fileURLToPath(new URL(url)));
  if (!exists) {
    throw new Error(`File not found at ${url}`);
  }

  const worker = new Worker(WORKER_COLLECTING_ONE_EXPORT_FILE_URL, {
    env,
    workerData: {
      url,
      exportName,
      params,
    },
  });

  let errorData;
  let messageData;
  await new Promise((resolve) => {
    worker.once("message", (message) => {
      messageData = message;
    });
    worker.once("error", (error) => {
      errorData = error;
    });
    worker.once("exit", () => {
      resolve();
    });
  });

  if (errorData) {
    const error = new Error(errorData.message);
    error.name = errorData.name;
    error.stack = errorData.stack;
    throw error;
  }

  return messageData;
};

const extractHashFromUrl = (url) => {
  const urlObject = new URL(url);
  const { hash } = urlObject;
  urlObject.hash = "";
  const urlWithoutHash = String(urlObject);
  return { hash, urlWithoutHash };
};
