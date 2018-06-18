# createExecuteOnNode high level overview

```javascript
import { createExecuteOnNode } from "@dmail/dev-server"

createExecuteOnNode().then({ execute }) => execute({ file: "src/file.js" }))
```

High level version of what happens in `createExecuteOnNode`

```javascript
const startServer = () => {
  // start a server on a random free port like `https://127.0.0.1:54678`
  // it transpiles and serve everything under `https://127.0.0.1:54678/build/*`
  // on other urls it behaves like a file server
  // return { url }
}

const startNodeClient = () => {
  // spawn a child process
  // return { execute }
}

const createExecuteOnNode = () => {
  return startServer().then((server) => {
    return startNodeClient({ server })
  })
}
```

# createExecuteOnChromium high level overview

```javascript
import { createExecuteOnChromium } from "@dmail/dev-server"

createExecuteOnChromium({ headless: false }).then({ execute }) => execute({ file: "src/file.js" }))
```

High level version of what happens in `createExecuteOnChromium`

```javascript
const startServer = () => {
  // start a server on a random free port like `https://127.0.0.1:54678`
  // it transpiles and serve everything under `https://127.0.0.1:54678/build/*`
  // on other urls it behaves like a file server
  // return { url }
}

const startChromiumClient = () => {
  // start chromium using pupeeter
  // return { execute }
}

const createExecuteOnChromium = ({ file, headless }) => {
  return startServer().then((server) => {
    return startChromiumClient({ headless, server })
  })
}
```
