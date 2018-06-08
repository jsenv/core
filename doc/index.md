# createExecuteOnNode high level overview

```javascript
import { createExecuteOnNode } from "@dmail/dev-server"

createExecuteOnNode().then({ execute }) => execute("src/file.js"))
```

High level version of what happens in `createExecuteOnNode`

```javascript
const startServer = () => {
  // start a server on a random free port like `https://127.0.0.1:54678`
  // it transpiles and serve everything under `https://127.0.0.1:54678/build/*`
  // on other urls it behaves like a file server
  // return { url, close }
}

const startNodeClient = () => {
  // spawn a child process
  // return { execute, close }
}

const createExecuteOnNode = () => {
  return Promise.all([startServer(), startNodeClient()]).then(([server, nodeClient]) => {
    const execute = (file) => {
      return nodeClient.execute(`build/${file}`)
    }

    const close = () => {
      server.close()
      nodeClient.close()
    }

    return { execute, close }
  })
}
```

# createExecuteOnChromium high level overview

```javascript
import { createExecuteOnChromium } from "@dmail/dev-server"

createExecuteOnChromium({ headless: true }).then({ execute }) => execute("src/file.js"))
```

High level version of what happens in `createExecuteOnChromium`

```javascript
const startServer = () => {
  // start a server on a random free port like `https://127.0.0.1:54678`
  // it transpiles and serve everything under `https://127.0.0.1:54678/build/*`
  // on other urls it behaves like a file server
  // return { url, close }
}

const startChromiumClient = () => {
  // start chromium using pupeeter
  // return { execute, close }
}

const createExecuteOnChromium = ({ file, headless }) => {
  return Promise.all([startServer(), startChromiumClient({ headless })]).then(
    ([server, chromiumClient]) => {
      const execute = (file) => {
        return chromiumClient.execute(`build/${file}`)
      }

      const close = () => {
        server.close()
        chromiumClient.close()
      }

      return { execute, close }
    },
  )
}
```
