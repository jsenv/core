import { execSync } from "node:child_process";
import { platform } from "node:os";

const platformName = platform();

if (platformName === "darwin") {
  console.log("Detected macOS. Starting PostgreSQL...");
  execSync("brew services start postgresql", { stdio: "inherit" });
  process.exit(0);
}

if (platformName === "linux") {
  console.log("Detected Linux. Starting PostgreSQL...");
  execSync("sudo service postgresql start", { stdio: "inherit" });
  process.exit(0);
}

if (platformName === "win32") {
  console.log("Detected Windows. Starting PostgreSQL...");
  execSync('pg_ctl -D "C:\\Program Files\\PostgreSQL\\14\\data" start', {
    stdio: "inherit",
  });
  process.exit(0);
}

throw new Error(`Unsupported operating system: ${platformName}`);
