import { listenEvent } from "./listen_event.js";

export const trackServerPendingConnections = (nodeServer) => {
  const pendingConnections = new Set();

  const removeConnectionListener = listenEvent(
    nodeServer,
    "connection",
    (connection) => {
      pendingConnections.add(connection);
      listenEvent(
        connection,
        "close",
        () => {
          pendingConnections.delete(connection);
        },
        { once: true },
      );
    },
  );

  const stop = async (reason) => {
    removeConnectionListener();
    const pendingConnectionsArray = Array.from(pendingConnections);
    pendingConnections.clear();
    await Promise.all(
      pendingConnectionsArray.map((pendingConnection) => {
        return destroyConnection(pendingConnection, reason);
      }),
    );
  };

  return { stop };
};

const destroyConnection = (connection, reason) => {
  return new Promise((resolve, reject) => {
    connection.destroy(reason, (error) => {
      if (error) {
        if (error === reason || error.code === "ENOTCONN") {
          resolve();
        } else {
          reject(error);
        }
      } else {
        resolve();
      }
    });
  });
};
