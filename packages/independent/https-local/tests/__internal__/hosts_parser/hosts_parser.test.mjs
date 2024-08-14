import { assert } from "@jsenv/assert";
import { readFile } from "@jsenv/filesystem";
import { parseHosts } from "@jsenv/https-local/src/internal/hosts.js";

if (process.platform === "win32") {
  process.exit(0);
}

const hostsAContent = await readFile(
  new URL("./hosts_files/hosts", import.meta.url),
  { as: "string" },
);
const hostsA = parseHosts(hostsAContent);

{
  const actual = hostsA.getAllIpHostnames();
  const expect = {
    "127.0.0.1": ["localhost", "loopback", "tool.example.com", "jsenv"],
    "255.255.255.255": ["broadcasthost"],
    "::1": ["localhost"],
  };
  assert({ actual, expect });
}

{
  const actual = hostsA.getIpHostnames("127.0.0.1");
  const expect = ["localhost", "loopback", "tool.example.com", "jsenv"];
  assert({ actual, expect });
}

// without touching anything output is the same
{
  const actual = hostsA.asFileContent();
  const expect = hostsAContent;
  assert({ actual, expect });
}

// after removing loopback
{
  hostsA.removeIpHostname("127.0.0.1", "loopback");
  const actual = hostsA.asFileContent();
  const expect = await readFile(
    new URL("./hosts_files/hosts_after_removing_loopback", import.meta.url),
    { as: "string" },
  );
  assert({ actual, expect });
}

// after adding example
{
  hostsA.addIpHostname("127.0.0.1", "example");
  const actual = hostsA.asFileContent();
  const expect = await readFile(
    new URL("./hosts_files/hosts_after_adding_example", import.meta.url),
    { as: "string" },
  );
  assert({ actual, expect });
}
