# 15.0.0

- Change how to enable https

  **14.1.6**

  ```js
  import { startServer } from "@jsenv/server"

  await startServer({
    protocol: "https",
    certificate: "",
    privateKey: "",
  })
  ```

  **15.0.0**

  ```js
  import { startServer } from "@jsenv/server"

  await startServer({
    https: { certificate: "", privateKey: "" },
  })
  ```

# 14.1.5

- return 504 when server takes more than 10s to start responding

# 14.1.0

- request.ressource renamed request.resource

# 14.0.0

- rename "host" parameter into "hostname" (match web standards)
- correct handling of ipv6 and dns resolution
- startServer nows returns server.hostname

# 13.1.0

- add "handleWebsocket" to services

# 13.0.0

- Add changelog.md
