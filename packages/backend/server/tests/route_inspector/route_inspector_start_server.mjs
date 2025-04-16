import { startServer } from "@jsenv/server";

export const server = await startServer({
  logLevel: "off",
  port: 6578,
});
