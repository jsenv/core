const { execute, launchNode } = require("@jsenv/core")
const {
  importMap,
  projectFolder,
  compileInto,
  babelPluginDescription,
} = require("../../jsenv.config.js")
const { getFromProcessArguments } = require("./getFromProcessArguments.js")

const filenameRelative = getFromProcessArguments("file")

execute({
  importMap,
  projectFolder,
  compileInto,
  babelPluginDescription,
  protocol: "http",
  launch: (options) =>
    launchNode({
      ...options,
      // ideally we should not force the child debug port
      // and vscode should automatically attach to the dynamic port.
      // in practice vscode often debugger says it is attached but
      // does not start executing the code.
      // as a workaround, the debug port is static
      // and there is a .vscode/launch.json/#jsenv-node-attach-child
      // that you can use to reattach a debugger to this port
      debugPort: 40000,
    }),
  filenameRelative,
  verbose: false,
  mirrorConsole: true,
})
