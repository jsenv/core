# dev-server

- inside bundle throw if compileGroupCount is 0
- inside bundle if compileGroupCount is 1 do not generate any compileGroup
  nor the balancer files
- consider updating fromHref inside registreModuleFrom to
  avoid evaluating base on response content-type ?
  It apparently could be a vulnerability issue in case of man in the middle. We could rely on file extension instead

* follow up https://github.com/systemjs/systemjs/issues/1898
* test all stuff inside dev-server-poc

* create an other repo using dev-server-poc bundled files
  test the other repo can bundle dev-server-poc too
