# @jsenv/core

[![npm package](https://img.shields.io/npm/v/@jsenv/core.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/core)

Jsenv is a suite of tools that can be used in projects involving JavaScript.

The goal of `@jsenv/core` is to provide the following tools:

1. **dev server**; A server that serves source files, facilitating development with live reloading.
2. **build**; Optimizes source files into a specified directory for production.
3. **build server**; Serves the built files, allowing for testing and verifying the production build.
4. **test runner**; Runs test files concurrently, ensuring code reliability.

Jsenv prioritizes standards and simplicity, making it ideal for both beginners and those who need straightforward tools without unnecessary complexities.

To try jsenv on your machine, use [@jsenv/cli](./packages/related/cli/#jsenvcli).

For additional details, consult the [documentation](./docs/users/users.md)

# The best parts

- **Robust versioning during build**: Avoids <a href="https://bundlers.tooling.report/hashing/avoid-cascade/" target="_blank">cascading hash changes</a><sup>↗</sup>.
- **Load js module with classic script**: See the [asJsClassic plugin](./docs/users/g_plugins/g_plugins.md#2asjsclassic>).
- **Large browser support after build**: Ensures compatibility with older versions of Firefox, Chrome, and Safari.
- **Advanced support of top level await**.
- **Advanced support of web workers**.
- **Test files are executed like standard files**.
- **Isolated environment for each test file**: Ensures tests run independently, preventing side effects.
- Single set of files after build: Simplifies support and deployement with a single set of files.
- Execute tests in multiple browsers: Supports Chrome, Safari, and Firefox.
- Extensive browser support during dev: Allows the use of various browsers beyond the latest Chrome, which is useful for reproducing browser-specific bugs.

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
