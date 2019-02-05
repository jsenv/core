# dev-server

todo list

- follow up https://github.com/systemjs/systemjs/issues/1898
- should rewrite and ensure behaviour of all launchNode and launchChromium cases
  like throwing, top level import, timeout, dynamic import
  keeping alive, scoped node module, correct breakpoint on debugger
- do not forget inside the script called cover
  to catch cancellation error and log when it happens
- Avoid node_modules in coverageMap
- an api to bundle js into dist
