# execution

This feature is provided by `@jsenv/core` which exports a function called `execute`.<br />

It is a function that will launch a browser or a node.js process to execute a file inside it.
It dynamically transforms file source to make it executable on the platform.

This documentation explains how to use `execute` inside a project.

## How to use

Using a basic project setup we'll see how to use `execute` to create script capable to execute file inside chromium or node.js.

### Basic project setup

1. Create basic project file structure

   — see [./basic-project](./basic-project)

2. Install dependencies

   ```console
   npm install
   ```

### Browser execution with chromium

```console
node ./execute-chromium.js index.js
```

`browser` will be logged in your terminal.

### Node execution

```console
node ./execute-node.js index.js
```

`node` will be logged in your terminal.

#### Use `execute` to debug file withing vscode

What if you could debug inside node.js the file currently opened in vscode?<br />

1. Add a launch configuration in `root/.vscode/launch.json`

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "jsenv-node",
      "type": "node",
      "request": "launch",
      "protocol": "inspector",
      "program": "${workspaceFolder}/execute-node.js",
      "args": ["${relativeFile}"],
      "autoAttachChildProcesses": true,
      "sourceMaps": true,
      "sourceMapPathOverrides": {
        "/*": "${workspaceFolder}/*"
      },
      "smartStep": true,
      "skipFiles": ["node_modules/**", "<node_internals>/**/*.js"]
    }
  ]
}
```

2. Start a debugging session using `jsenv node`

I made a video of the debugging session inside vscode. The gif below was generated from that video.

![vscode debug node gif](./vscode-debug-node.gif)

Sometimes vscode fails to auto attach child process debugging session.<br />
According to my experience it happens mostly on windows.<br />
When it happens you must manually attach it.<br />

To do that you can add an other configuration in your `launch.json`.

```json
{
  "name": "jsenv-node-attach-child",
  "type": "node",
  "request": "attach",
  "port": 3456,
  "smartStep": true,
  "sourceMaps": true,
  "sourceMapPathOverrides": {
    "/*": "${workspaceFolder}/*"
  },
  "skipFiles": ["node_modules/**", "<node_internals>/**/*.js"]
}
```

Using this configuration also means your child process debug session listens at `3456`. You must update the execute-node script to force `3456` port like this:

```js
const { execute } = require("@jsenv/core")
const { launchNode } = require("@jsenv/node-launcher")

execute({
  projectPath: __dirname,
  launch: (options) => launchNode({ ...options, debugPort: 3456 }),
  fileRelativePath: `/${process.argv[2]}`,
})
```

If you want to know more about `execute`, there is a more detailed documentation on it.<br />
— see [`execute` documentation](./execute-doc.md)

# End

You've reached the end of this documentation, congrats for scrolling so far.<br />
Let me suggest you to:

- take a break, reading doc or scrolling can be exhausting :)
- [go back to readme](../../README.md#how-to-use)

If you noticed issue in this documentation, you're very welcome to open [an issue](https://github.com/jsenv/jsenv-core/issues). I would love you even more if you [create a pull request](https://github.com/jsenv/jsenv-core/pulls) to suggest an improvement.
