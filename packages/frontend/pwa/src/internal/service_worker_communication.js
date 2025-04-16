export const inspectServiceWorker = async (serviceWorker) => {
  let serviceWorkerResponse;
  const inspectPromise = postMessageToServiceWorker(serviceWorker, {
    action: "inspect",
  }).then((info) => {
    if (typeof info !== "object") {
      throw new TypeError(
        `service worker script must send an object in response to inspect`,
      );
    }
    serviceWorkerResponse = info;
  });
  let timeout;
  let timeoutReached = false;
  const timeoutPromise = new Promise((resolve) => {
    timeout = setTimeout(() => {
      timeoutReached = true;
      resolve();
    }, 1000);
  });
  await Promise.race([inspectPromise, timeoutPromise]);
  clearTimeout(timeout);
  if (timeoutReached) {
    return {};
  }
  return serviceWorkerResponse;
};

export const requestSkipWaitingOnServiceWorker = (serviceWorker) => {
  return postMessageToServiceWorker(serviceWorker, { action: "skipWaiting" });
};

export const requestClaimOnServiceWorker = (serviceWorker) => {
  return postMessageToServiceWorker(serviceWorker, { action: "claim" });
};

// https://felixgerschau.com/how-to-communicate-with-service-workers/
export const postMessageToServiceWorker = (serviceWorker, message) => {
  const { port1, port2 } = new MessageChannel();
  return new Promise((resolve, reject) => {
    port1.onmessage = (messageEvent) => {
      const { data } = messageEvent;
      if (
        data &&
        typeof data === "object" &&
        typeof data.actionResultStatus === "string"
      ) {
        if (data.actionResultStatus === "rejected") {
          reject(data.actionResultValue);
        } else {
          resolve(data.actionResultValue);
        }
      } else {
        resolve(data);
      }
    };
    serviceWorker.postMessage(message, [port2]);
  });
};
