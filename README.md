# @jsenv/core [![npm package](https://img.shields.io/npm/v/@jsenv/core.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/core)

Jsenv was first created to write tests that could be executed in different runtimes.
It has naturally evolved to cover the core needs of a JavaScript project: developement, testing and building for production.

- :exploding_head: Execute HTML files as tests
- :sparkles: Dev, tests and build in a single tool
- :ok_hand: Seamless integration with standard HTML, CSS and JS

# Documentation

| Link                                                                               | Description                                    |
| ---------------------------------------------------------------------------------- | ---------------------------------------------- |
| [Getting started](https://github.com/jsenv/jsenv-core/wiki//Getting-started)       | Showcasing jsenv usage in small demos          |
| [Browser support](https://github.com/jsenv/jsenv-core/wiki//Browser-support)       | browser support during dev and after build     |
| [Assets and workers](https://github.com/jsenv/jsenv-core/wiki//Assets-and-workers) | How to reference files within a file           |
| [Import resolution](https://github.com/jsenv/jsenv-core/wiki/Import-resolution)    | Import resolution inside js modules            |
| [NPM package](https://github.com/jsenv/jsenv-core/wiki/NPM-package)                | How to use a NPM package (especially commonjs) |
| [API](https://github.com/jsenv/jsenv-core/wiki/API)                                | Functions and parameters                       |

# Installation

```console
npm install --save-dev @jsenv/core
```

_@jsenv/core_ is tested on Mac, Windows, Linux with Node.js 18.5.0. Other operating systems and Node.js versions are not tested.

# Name

The name "jsenv" stands for JavaScript environments. This is because the original purpose of jsenv was to bring closer two JavaScript runtimes: web browsers and Node.js.

Maybe "jsenv" should be written "JSEnv"? That makes typing the name too complex:

1. Hold `shift` on keyboard
2. While holding `shift`, type `JSE`
3. Release `shift`
4. Finally, type `nv`.

No one wants to do that: the prefered syntax is "jsenv".

# Logo

The logo is composed by the name at the center and two circles orbiting around it. One of the circle is web browsers, the other is Node.js. It represents the two JavaScript environments supported by jsenv.

![jsenv logo with legend](./docs/jsenv_logo_legend.png)

# See also

| Link                                                                                              | Description                                             |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [@jsenv/assert](./packages/assert)                                                                | NPM package to write assertions                         |
| [I am too lazy for a test framework](https://dev.to/dmail/i-am-too-lazy-for-a-test-framework-92f) | Article presenting a straightforward testing experience |
