To be tested:

- test how jsenv-core behaves if you import a dependency
  written in commonjs

- do not forget to tell
  generator are not supported because
  we miss a strategy regarding regeneratorRuntime
- sourceMaps gets broken if you use transform-async-to-promises and its
  actually transpiled because it seems to generate bad sourcemap
  after transform-modules-systemjs is applied

- having to require the importMap.json everywhere is kinda annoying
  and having to run generate-import-map after any npm i could be annoying too. It's also error prone.
  The thing is that you should be able to trust what you pass
  and not automagically generate importMap for node_modules.
  Also jsenv-eslint-import-resolver is watching importMap.json
  it needs it.
  Moreover later you may want to generate more stuff inside importMap.json from a webpack config or whatever.
