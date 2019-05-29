# jsenv-core

[![npm package](https://img.shields.io/npm/v/@jsenv/core.svg)](https://www.npmjs.com/package/@jsenv/core)
[![build](https://travis-ci.com/jsenv/jsenv-core.svg?branch=master)](http://travis-ci.com/jsenv/jsenv-core)
[![codecov](https://codecov.io/gh/jsenv/jsenv-core/branch/master/graph/badge.svg)](https://codecov.io/gh/jsenv/jsenv-core)

> jsenv-core helps to run your JavaScript in well-known scenarios.

## History behind jsenv

A long time ago, not even aware of github repositories or npm packages, I was learning to code.
After some years I discovered benefits of module: writing scoped code.
But for one exported function that people will use, you may have X private function that you want to test.

From the outside a module is likely going to have one entry point.
From the inside, when you develop a module, you may want to consider any file as an entry point in order to test it.

> Unfortunately, most tools assumes you have one main file for your entire project.

It means you have to build the entire project to test one file leading to 2 issues:

- Slower to test a file
- Hard to test a file isolated from the rest of the project

jsenv main goal is to provide a solution capable to turn any JavaScript file into an entry point.

## Main dependencies

jsenv relies mainly on the following projects:

- https://github.com/babel/babel
- https://github.com/systemjs/systemjs
- https://github.com/rollup/rollup

Thank you to people behind these projects, they helped me a lot.

## Documentation

There is not yet official documentation.
I'm not planning to add it very soon because it's a lot of work and there is an acceptable alternative:

I encourage you to check (my) projects powered by jsenv

- https://github.com/dmail/assert
- https://github.com/dmail/uneval

You can understand how jsenv is meants to be used by checking their package.json scripts section:
https://github.com/dmail/assert/blob/3a308d2e78b9ea217807e27ed4597fbf71f3903f/package.json#L38-L52

## Demonstration

This section will show what is cool about jsenv.

List of cool stuff

- You can use import starting with / `import from '/src/file.js'`
- You can use top level await
- You can use dynamic import
- You can use import.meta.url
- Project browser explorer: server sending a self executing html for every file of your project
- Project code coverage solution
- Project can have several entry points
- Test file contains regular code, no weird syntax/concept like jasmine.
- Test file can be runned on chromium, on nodejs or on both.
- Test file can kill node/chrome with infinite loop, next one guaranteed to run thanks to dedicated node process or chromium instance.
- vscode: one click to debug any file with nodejs debugger
- vscode: one click to debug any file with chrome debugger

TODO: add screenshots, video, whatever to show evidence of the list above :)
