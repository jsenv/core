import { parentPort, workerData } from "node:worker_threads";

const { url } = workerData;
await import(url);
parentPort.postMessage("done");
