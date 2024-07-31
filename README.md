# @jsenv/core 
[![npm package](https://img.shields.io/npm/v/@jsenv/core.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/core)

Jsenv is a suite of tools that can be used in projects involving JavaScript.

`@jsenv/core` goal is too provide the following tools:

1. **dev server**; a server for source files
2. **build**; generate an optimized version of source files into a directory
3. **build server**; a server for build files
4. **test runner**; execute all test files at once

It favors standards and simplicity.  
As a result it can be enjoyed by people without much experience in tooling or seeking for simple tools without hidden complexities.

If you want to try jsenv on your machine, use [@jsenv/cli](./packages/related/cli/readme.md).

Link to [documentation](./md/users/users.md)

# The best parts

- Test files are [executed like standard files](./md/users/d_test/d_test.md#14-executing-a-single-test)
- [Isolated environment](./md/users/d_test/d_test.md#33-isolated-environment) for each test file
- Execute [tests in multiple browsers](./md/users/d_test/d_test.md#32-execute-on-more-browsers>): Chrome, Safari, Firefox
- [Large browser support during dev](./md/users/b_dev/b_dev.md#21-browser-support>). Because some people might be happy to use an other browser than the latest chrome during dev. Moreover it is useful to reproduce bug specific to certain browsers.
- [Large browser support after build](./md/users/c_build/c_build.md#211-maximal-browser-support). Because some product still needs to support old versions of Firefox, Chrome and Safari.
- [Single set of files after build](./md/users/c_build/c_build.md#212-same-build-for-all-browsers). Because a single one is simpler to properly support in every aspects.
- Versioning during build is robust and <a href="https://bundlers.tooling.report/hashing/avoid-cascade/" target="_blank">avoids cascading hash changes</a><sup>↗</sup>
- Advanced support of top level await, allowing to use it everywhere
- Advanced support of web workers including worker type module
- Unlock [js module features on a classic `<script>`](./md/users/g_plugins/g_plugins.md#22-asjsclassic>).

<!--
The following commands can be used to skip the prompt

| Command                                     |
| ------------------------------------------- |
| `npm create jsenv@latest -- --web`          |
| `npm create jsenv@latest -- --web-preact`   |
| `npm create jsenv@latest -- --web-react`    |
| `npm create jsenv@latest -- --node-package` |
-->

<!-- # Installation

```console
npm install --save-dev @jsenv/core
```

_@jsenv/core_ is tested on Mac, Windows, Linux with Node.js 20.
Other operating systems and Node.js versions are not tested. -->
