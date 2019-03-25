To be tested:

- test how jsenv-core behaves if you import a dependency
  written in commonjs

- having to require the importMap.json everywhere is kinda annoying
  and having to run generate-import-map after any npm i could be annoying too. It's also error prone.
  The thing is that you should be able to trust what you pass
  and not automagically generate importMap for node_modules.
  Also jsenv-eslint-import-resolver is watching importMap.json
  it needs it.
  Moreover later you may want to generate more stuff inside importMap.json from a webpack config or whatever.
