# dev-server

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
