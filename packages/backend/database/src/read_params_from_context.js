import { config } from "dotenv";
import { execSync } from "node:child_process";

export const readParamsFromContext = () => {
  config({
    path:
      process.env.NODE_ENV === "production" || process.env.NODE_ENV === "prod"
        ? ".env.prod"
        : ".env.dev",
  });

  if (!process.env.DB_NAME) {
    throw new Error("process.env.DB_NAME is not set");
  }
  if (!process.env.DB_USER_ROLE_NAME) {
    throw new Error("process.env.DB_USER_ROLE_NAME is not set");
  }
  if (!process.env.DB_USER_NAME) {
    throw new Error("process.env.DB_USER_NAME is not set");
  }
  if (!process.env.DB_USER_PASSWORD) {
    throw new Error("process.env.DB_USER_PASSWORD is not set");
  }

  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || 5432;
  const database = process.env.DB_NAME;
  const userRoleName = process.env.DB_USER_ROLE_NAME;
  const username = process.env.DB_USER_NAME;
  const password = process.env.DB_USER_PASSWORD;
  const defaultUsername = execSync("whoami").toString().trim();

  return {
    host,
    port,
    database,
    userRoleName,
    username,
    password,
    defaultUsername,
  };
};
