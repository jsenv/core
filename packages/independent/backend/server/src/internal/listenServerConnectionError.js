import { listenEvent } from "./listenEvent.js";

export const listenServerConnectionError = (
  nodeServer,
  connectionErrorCallback,
  { ignoreErrorAfterConnectionIsDestroyed = true } = {},
) => {
  const cleanupSet = new Set();

  const removeConnectionListener = listenEvent(
    nodeServer,
    "connection",
    (socket) => {
      const removeSocketErrorListener = listenEvent(
        socket,
        "error",
        (error) => {
          if (ignoreErrorAfterConnectionIsDestroyed && socket.destroyed) {
            return;
          }
          connectionErrorCallback(error, socket);
        },
      );
      const removeOnceSocketCloseListener = listenEvent(
        socket,
        "close",
        () => {
          removeSocketErrorListener();
          cleanupSet.delete(cleanup);
        },
        {
          once: true,
        },
      );
      const cleanup = () => {
        removeSocketErrorListener();
        removeOnceSocketCloseListener();
      };
      cleanupSet.add(cleanup);
    },
  );
  return () => {
    removeConnectionListener();
    cleanupSet.forEach((cleanup) => {
      cleanup();
    });
    cleanupSet.clear();
  };
};
