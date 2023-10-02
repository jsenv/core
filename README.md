# @jsenv/core [![npm package](https://img.shields.io/npm/v/@jsenv/core.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/core)

Jsenv is a tool to develop test and build projects using JavaScript. Jsenv is simple, easy to understand and well [documented](<https://github.com/jsenv/core/wiki/A)-directory-structure>).

Jsenv cares a lot about the developper experience, especially when it comes to tests.

The pillars of jsenv are:

1. A dev server serving source files with autoreload
2. A build generating an optimized version of source files into a directory
3. A build server serving build files
4. A test runner executing test files in web browser(s)

# The best parts

## Reduce cognitive load inside test files

When coding, we spend most of our time working on source files. At some point we switch from source files to test files. Suddenly things are different:

- code does not execute as it would in source files
- some tools are used differently in test files, some cannot be used at all
- you are forced to code in a certain way that is completely different from the one in source files

This huge gap between source files and test files creates a context switching costing a lot of cognitive energy.  
Jsenv makes a special effort to [provide a solution](<https://github.com/jsenv/core/wiki/D)-Test>) where switching from source files to test files is easy.

It also means tools used on source files can be reused on test files: ESlint, VSCode debugger, etc. No need to maintain separate tools and/or configurations.

## Other good parts

- A [large browser support during dev](<https://github.com/jsenv/core/wiki/B)-Dev#21-browser-support>). Because some people might be happy to use an other browser than the latest chrome during dev. Moreover it is useful to reproduce bug specific to certain browsers.
- A [large browser support after build](<https://github.com/jsenv/core/wiki/C)-Build#211-maximal-browser-support>). Because some product still needs to support old versions of Firefox, Chrome and Safari.
- A [single set of files during build](<https://github.com/jsenv/core/wiki/C)-Build#212-same-build-for-all-browsers>). Because a single one is simpler to properly support in every aspects.
- Versioning during build is robust and <a href="https://bundlers.tooling.report/hashing/avoid-cascade/" target="_blank">avoids cascading hash changes</a><sup>↗</sup>
- Ability to [execute tests in multiple browsers](<https://github.com/jsenv/core/wiki/D)-Test#32-executing-on-more-browsers>): Chrome, Safari, Firefox
- An advanced support of top level await, allowing to use it everywhere
- An advanced support of web workers including worker type module
- Unlock js module features on a regular `<script>` when needed. If you need the behaviour of `<script>` which is to block other `<script>` tag in the page, you'll be happy to still have the power of js modules, like imports, at your disposal.

# Demos

A demo is a project pre-configured with jsenv.

The following command can be used to install and try a demo:

```console
npm create jsenv@latest
```

It will prompt to choose one of the available demo:

```console
? Select a demo: › - Use arrow-keys. Return to submit.
❯   web
    web-react
    web-preact
    node-package
```

Selecting "web" will copy [create-jsenv/demo-web](https://github.com/jsenv/core/tree/bc7fb0aa2c8ced1db4d7583a2ea1858be464c23b/packages/related/create-jsenv/demo-web)<sup>↗</sup> files into a directory:

```console
✔ Select a demo: › web
✔ copy demo files into "[...]jsenv-demo-web/" (done in 0.1 second)
----- commands to run -----
cd jsenv-demo-web
npm install
npm start
---------------------------
```

After running the suggested commands the demo is ready.

> **Info**
> "npm install" can take time because tests are runned in headless browsers that needs to be installed first.

The demo contains preconfigured scripts:

- `npm run dev`: starts a server for source files; Documented in [B) Dev](<https://github.com/jsenv/core/wiki/B)-Dev>).
- `npm run build`: generate files optimized for production; Documented in [C) Build](<https://github.com/jsenv/core/wiki/C)-Build>).
- `npm run build:serve`: start a server for build files; Documented in [C) Build#how-to-serve-build-files](<https://github.com/jsenv/core/wiki/C)-Build#3-how-to-serve-build-files>).
- `npm run test`: execute test files on browsers(s); Documented in [D) Test](<https://github.com/jsenv/core/wiki/D)-Test>).

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
