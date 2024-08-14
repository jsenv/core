import {
  parseHosts,
  readHostsFile,
  writeHostsFile,
} from "@jsenv/https-local/src/internal/hosts.js";

const hostsFileContent = await readHostsFile();
const hostnames = parseHosts(hostsFileContent);
const localIpHostnames = hostnames.getIpHostnames("127.0.0.1");
if (localIpHostnames.includes("localhost")) {
  hostnames.removeIpHostname("127.0.0.1", "localhost");
}
if (localIpHostnames.includes("local.example.com")) {
  hostnames.removeIpHostname("127.0.0.1", "local.example");
}
await writeHostsFile(hostnames.asFileContent());
