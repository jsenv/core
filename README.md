# dev-server

- now we have genereateImportMapForNodeModules
  let's remove locateModuleFilename inside locate.js
- test all stuff inside dev-server-poc
- create an other repo using dev-server-poc bundled files
  test the other repo can bundle dev-server-poc too
- consider updating fromHref inside registreModuleFrom to
  avoid evaluating base on response content-type ?
  It apparently could be a vulnerability issue in case of man in the middle. We could rely on file extension instead
- a format command that can be cancelled on ctrl+c too
  (will use prettiest under the hood)

- small typo in projectStructure when checking metaDescription presence
  in selectFileInsideFolder
- prettiest should be renamed into checkAllFileFormatInsideFolder
  and expect a pathname instead of folder

- follow up https://github.com/systemjs/systemjs/issues/1898

later

- genereateImportMapForNodeModules option to
  allow bare import to be remapped to node module location

- a function capable to generate importMap from a webpack config object

- eslint-plugin-import of jsenv must accept
  an optionnal importMap so that it could work with webpack
  not required earlier because eslint-plugin-import already capable to locate node_module and does not need build/best/ scoping
