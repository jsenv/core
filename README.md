# dev-server

- follow up https://github.com/systemjs/systemjs/issues/1898
- test all stuff inside dev-server-poc
- root/remoteRoot/localRoot are error prone
  root is /User/folder
  localRoot is /User/folder
  remoteRoot is http://ip:port/

  remoteRoot is an url
  localRoot is the pathname portion of a file url
  the naming should either reflect this difference or
  and localRoot should become an url like remoteRoot ?

  root should be renamed rootPathname and be '/Users/me/folder' for instance
  localRoot should be renamed rootHref and be 'file:///Users/me/folder'
  remoteRoot should be renamed compiledRootHref and be 'http://ip:port/'

  check locaters to see the renaming impact

- create an other repo using dev-server-poc bundled files
  test the other repo can bundle dev-server-poc too
