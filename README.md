# dev-server

- test all stuff inside dev-server-poc
- create an other repo using dev-server-poc bundled files
  test the other repo can bundle dev-server-poc too
- consider updating fromHref inside registreModuleFrom to
  avoid evaluating base on response content-type ?
  It apparently could be a vulnerability issue in case of man in the middle. We could rely on file extension instead

later

- a function capable to generate importMap from a webpack config object

- eslint-plugin-import of jsenv must accept
  an optionnal importMap so that it could work with webpack
  not required earlier because eslint-plugin-import already capable to locate node_module and does not need build/best/ scoping
