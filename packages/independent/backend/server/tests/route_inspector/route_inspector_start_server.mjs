import { startServer } from "@jsenv/server";

export const server = await startServer({
  logLevel: "warn",
  port: 6578,
});
