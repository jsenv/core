import { verifyHostsFile } from "@jsenv/https-local"

await verifyHostsFile({
  ipMappings: {
    "127.0.0.1": ["localhost", "local.example"],
  },
})
