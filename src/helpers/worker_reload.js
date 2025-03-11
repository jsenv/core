import { fileURLToPath } from "node:url";
import { Worker, workerData } from "node:worker_threads";

// https://nodejs.org/api/worker_threads.html
export const createReloadableWorker = (workerFileUrl, options = {}) => {
  const workerFilePath = fileURLToPath(workerFileUrl);
  const isPrimary = !workerData || workerData.workerFilePath !== workerFilePath;
  let worker;

  const terminate = async () => {
    if (worker) {
      let _worker = worker;
      worker = null;
      const exitPromise = new Promise((resolve) => {
        _worker.once("exit", resolve);
      });
      _worker.terminate();
      await exitPromise;
    }
  };

  const load = async () => {
    if (!isPrimary) {
      throw new Error(`worker can be loaded from primary file only`);
    }
    worker = new Worker(workerFilePath, {
      ...options,
      workerData: {
        ...options.workerData,
        workerFilePath,
      },
    });
    worker.once("error", (error) => {
      console.error(error);
    });
    worker.once("exit", () => {
      worker = null;
    });
    await new Promise((resolve) => {
      worker.once("online", resolve);
    });
    return worker;
  };

  const reload = async () => {
    await terminate();
    await load();
  };

  return {
    isPrimary,
    isWorker: !isPrimary,
    load,
    reload,
    terminate,
  };
};
