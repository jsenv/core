# @jsenv/core

[![npm package](https://img.shields.io/npm/v/@jsenv/core.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/core)

Jsenv is a suite of tools that can be used in projects involving JavaScript.

`@jsenv/core` goal is too provide the following tools:

1. **dev server**; A server that serves source files, facilitating development with live reloading.
2. **build**; Generates an optimized version of source files into a specified directory for production deployment.
3. **build server**; Serves the built files, allowing for testing and verification of the production build.
4. **test runner**; Executes all test files concurrently, ensuring code reliability and correctness.

It favors standards and simplicity.  
This makes jsenv suitable for individuals with limited experience in tooling or those seeking straightforward tools without hidden complexities.

If you want to try jsenv on your machine, use [@jsenv/cli](./packages/related/cli/#jsenvcli).

Link to [documentation](./docs/users/users.md)

# The best parts

- Test files are [executed like standard files](./docs/users/d_test/d_test.md#14-executing-a-single-test)
- [Isolated environment](./docs/users/d_test/d_test.md#33-isolated-environment) for each test file. Ensures tests run independently, preventing side effects.
- Execute [tests in multiple browsers](./docs/users/d_test/d_test.md#32-execute-on-more-browsers>). Supports Chrome, Safari, and Firefox for comprehensive testing.
- [Large browser support during dev](./docs/users/b_dev/b_dev.md#21-browser-support>). Allows the use of various browsers beyond the latest Chrome, aiding in reproducing browser-specific bugs.
- [Large browser support after build](./docs/users/c_build/c_build.md#211-maximal-browser-support). Comprehensive browser support after build ensures compatibility with older versions of Firefox, Chrome, and Safari.
- [Single set of files after build](./docs/users/c_build/c_build.md#212-same-build-for-all-browsers). Simplifies deployment and support by generating a unified set of files.
- Versioning during build is robust and <a href="https://bundlers.tooling.report/hashing/avoid-cascade/" target="_blank">avoids cascading hash changes</a><sup>↗</sup>
- Advanced support of top level await, allowing to use it everywhere
- Advanced support of web workers including worker type module
- Unlock [js module features on a classic `<script>`](./docs/users/g_plugins/g_plugins.md#22-asjsclassic>).

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
