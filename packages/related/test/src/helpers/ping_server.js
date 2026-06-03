import { createConnection } from "node:net";

export const pingServer = async (url) => {
  const { hostname, port } = new URL(url);

  return new Promise((resolve) => {
    const socket = createConnection({ hostname, port: Number(port) });
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      resolve(false);
    });
  });
};
