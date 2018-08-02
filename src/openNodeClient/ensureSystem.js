import { createNodeLoader } from "@dmail/module-loader/src/node/index.js"

const memoize = (fn) => {
  let called = false
  let memoizedValue
  return (...args) => {
    if (called) {
      return memoizedValue
    }
    memoizedValue = fn(...args)
    called = true
    return memoizedValue
  }
}

export const ensureSystem = memoize(({ localRoot, remoteRoot }) => {
  // when System.import evaluates the code it has fetched
  // it uses require('vm').runInThisContext(code, { filename }).
  // This filename is very important because it allows the engine to be able
  // to resolve source map location inside evaluated code like //# sourceMappingURL=./file.js.map

  // There is a "bug" with vscode

  // Vscode fetching sourceMap from filesystem logs
  // ← From target: {"method":"Debugger.scriptParsed" ...
  // Paths.scriptParsed: could not resolve /Users/d.maillard/Dev/Sandbox/npmlink/packages/dev-server/compiled/src/__test__/file.js/vscodefix to a file with pathMapping/webRoot: undefined. It may be external or served directly from the server's memory (and that's OK).
  // SourceMaps.getMapForGeneratedPath: Finding SourceMap for /Users/d.maillard/Dev/Sandbox/npmlink/packages/dev-server/compiled/src/__test__/file.js/vscodefix by URI: ../../../../build/src/__test__/file.js/cjkc8nqf50000n4dlm8pg0xud/file.js.map
  // SourceMaps.loadSourceMapContents: Reading local sourcemap file from /Users/d.maillard/Dev/Sandbox/npmlink/packages/dev-server/build/src/__test__/file.js/cjkc8nqf50000n4dlm8pg0xud/file.js.map
  // To client: {"seq":0,"type":"event","event":"loadedSource","body":{"reason":"new","source":{"name":"vscodefix","path":"/Users/d.maillard/Dev/Sandbox/npmlink/packages/dev-server/compiled/src/__test__/file.js/vscodefix","sourceReference":2677,"origin":"contenu en lecture seule à partir du code Node.js"}}}
  // SourceMap: creating for /Users/d.maillard/Dev/Sandbox/npmlink/packages/dev-server/compiled/src/__test__/file.js/vscodefix
  // SourceMap: sourceRoot: undefined
  // SourceMap: sources: ["src/__test__/file.js"]
  // SourceMap: no sourceRoot specified, using script dirname: /Users/d.maillard/Dev/Sandbox/npmlink/packages/dev-server/compiled/src/__test__/file.js
  // SourceMaps.scriptParsed: /Users/d.maillard/Dev/Sandbox/npmlink/packages/dev-server/compiled/src/__test__/file.js/vscodefix was just loaded and has mapped sources: ["/Users/d.maillard/Dev/Sandbox/npmlink/packages/dev-server/compiled/src/__test__/file.js/src/__test__/file.js"]
  // ← From target: {"method":"Debugger.paused", ...

  // -> script wait for fs.readFile to be done

  // Vscode fetching sourceMap from http url logs
  // ← From target: {"method":"Debugger.scriptParsed", ...
  // Paths.scriptParsed: could not resolve http://127.0.0.1:8765/compiled/src/__test__/file.js to a file with pathMapping/webRoot: undefined. It may be external or served directly from the server's memory (and that's OK).
  // SourceMaps.getMapForGeneratedPath: Finding SourceMap for http://127.0.0.1:8765/compiled/src/__test__/file.js by URI: ../../../../build/src/__test__/file.js/cjkc8nqf50000n4dlm8pg0xud/file.js.map
  // SourceMaps.loadSourceMapContents: Downloading sourcemap file from http://127.0.0.1:8765/build/src/__test__/file.js/cjkc8nqf50000n4dlm8pg0xud/file.js.map
  // ← From target: {"method":"Console.messageAdded"...
  // To client: {"seq":0,"type":"event","event":"loadedSource","body":{"reason":"new","source":{"name":"file.js","path":"<node_internals>/http://127.0.0.1:8765/compiled/src/__test__/file.js","sourceReference":2677,"origin":"module de base en lecture seule"}}}
  // ← From target: {"method":"Runtime.consoleAPICalled",...
  // To client: {"seq":0,"type":"event","event":"output","body":{"category":"stdout","output":"execution done with { default: [Getter] }\n"}}
  // ← From target: {"method":"Console.messageAdded",...
  // ← From target: {"method":"Runtime.consoleAPICalled",...
  // Sourcemaps.downloadSourceMapContents: Caching sourcemap file at /var/folders/_y/_qf0g2dd2yn44pj45w1yj68c0000gp/T/com.microsoft.VSCode/node-debug2/sm-cache/858a306eecd8c47d885b52d5954c7c9260cb0f8ef314e3b9a2222a888cedf712
  // SourceMap: creating for http://127.0.0.1:8765/compiled/src/__test__/file.js
  // SourceMap: sourceRoot: undefined
  // ....

  // -> script does not wait for http.request() to be done

  // should I open a bug to vscode ?

  // for now we want to for the case where scripts waits so
  // getFileName below transforms
  // https://ip:port/folder/file.js -> /Users/dmail/folder/file.js

  // url below gives some context but does not help much
  // https://github.com/Microsoft/vscode-chrome-debug-core/blob/fb7ce14702c835253b6e0bad26fb746a2ce0f5d3/src/sourceMaps/sourceMapFactory.ts#L136

  const getFilename = (key) => {
    const filename = key.replace(remoteRoot, localRoot)

    // because of this line
    // https://github.com/Microsoft/vscode-chrome-debug-core/blob/fb7ce14702c835253b6e0bad26fb746a2ce0f5d3/src/sourceMaps/sourceMapUtils.ts#L137
    // we're adding a fake folder because path resolution differs from url resolution
    // filename = `${path.dirname(filename)}/vscodefix/${path.basename(filename)}`

    return filename
  }

  const System = createNodeLoader({
    getFilename,
  })

  global.System = System

  return System
})
