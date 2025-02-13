import { parentPort, workerData } from "node:worker_threads";

const { url, exportName, params } = workerData;
const namespace = await import(url);

if (!Object.prototype.hasOwnProperty.call(namespace, exportName)) {
  throw new Error(`No export named "${exportName}" in ${url}`);
}

const exportValue = namespace[exportName];
if (typeof exportValue === "function") {
  const metrics = await exportValue(params);
  parentPort.postMessage(metrics);
} else {
  const metrics = exportValue;
  parentPort.postMessage(metrics);
}
