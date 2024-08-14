import { verifyHostsFile } from "@jsenv/https-local"

await verifyHostsFile({
  logLevel: "debug",
  ipMappings: {
    "127.0.0.1": ["localhost", "local.example"],
  },
  tryToUpdateHostsFile: true,
})
