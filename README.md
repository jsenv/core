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

- create an other repo using dev-server-poc bundled files
  test the other repo can bundle dev-server-poc too
