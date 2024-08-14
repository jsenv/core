import { assert } from "@jsenv/assert"
import { readFile } from "@jsenv/filesystem"

import { parseHosts } from "@jsenv/https-local/src/internal/hosts.js"

const hostsAContent = await readFile(
  new URL("./hosts_files/hosts", import.meta.url),
  { as: "string" },
)
const hostsA = parseHosts(hostsAContent)

{
  const actual = hostsA.getAllIpHostnames()
  const expected = {
    "127.0.0.1": ["localhost", "loopback", "tool.example.com", "jsenv"],
    "255.255.255.255": ["broadcasthost"],
    "::1": ["localhost"],
  }
  assert({ actual, expected })
}

{
  const actual = hostsA.getIpHostnames("127.0.0.1")
  const expected = ["localhost", "loopback", "tool.example.com", "jsenv"]
  assert({ actual, expected })
}

// without touching anything output is the same
{
  const actual = hostsA.asFileContent()
  const expected = hostsAContent
  assert({ actual, expected })
}

// after removing loopback
{
  hostsA.removeIpHostname("127.0.0.1", "loopback")
  const actual = hostsA.asFileContent()
  const expected = await readFile(
    new URL("./hosts_files/hosts_after_removing_loopback", import.meta.url),
    { as: "string" },
  )
  assert({ actual, expected })
}

// after adding example
{
  hostsA.addIpHostname("127.0.0.1", "example")
  const actual = hostsA.asFileContent()
  const expected = await readFile(
    new URL("./hosts_files/hosts_after_adding_example", import.meta.url),
    { as: "string" },
  )
  assert({ actual, expected })
}
