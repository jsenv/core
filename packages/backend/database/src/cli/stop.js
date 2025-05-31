import { execSync } from "node:child_process";
import { platform } from "node:os";

const platformName = platform();

if (platformName === "darwin") {
  console.log("Detected macOS. Stopping PostgreSQL...");
  execSync("brew services stop postgresql", { stdio: "inherit" });
  process.exit(0);
}

if (platformName === "linux") {
  console.log("Detected Linux. Stopping PostgreSQL...");
  execSync("sudo service postgresql stop", { stdio: "inherit" });
  process.exit(0);
}

if (platformName === "win32") {
  console.log("Detected Windows. Stopping PostgreSQL...");
  execSync('pg_ctl -D "C:\\Program Files\\PostgreSQL\\14\\data" stop', {
    stdio: "inherit",
  });
  process.exit(0);
}

throw new Error(`Unsupported operating system: ${platformName}`);
