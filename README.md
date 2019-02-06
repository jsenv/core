# dev-server

- follow up https://github.com/systemjs/systemjs/issues/1898
- update code, especially browserPlatform to avoid thinking we can avoid
  Systemjs when browser/node supports import/export syntax.
  This is not true because of
  - top level await
  - custom module resolution (absolute moduleSpecifier relative to node module or project)
  - how we plan to avoid http request using system registry as first step
