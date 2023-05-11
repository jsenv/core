const testWorker = async (worker) => {
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      resolve(e.data);
    };
    worker.onerror = (e) => {
      reject(e.message);
    };
    worker.postMessage("ping");
  });
};

const worker = new Worker("/worker.js");
const workerResponse = await testWorker(worker);

const worker2 = new Worker(new URL("./worker.js", import.meta.url));
const worker2Response = await testWorker(worker2);

window.resolveNamespacePromise({
  workerResponse,
  worker2Response,
});
