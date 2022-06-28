# @jsenv/core [![npm package](https://img.shields.io/npm/v/@jsenv/core.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/core)

Jsenv was first created to write tests that could be executed in different runtimes. It has naturally evolved to cover the core needs of a JavaScript project.

- Seamless integration with standard HTML, CSS and JS
- Consistent and integral developer experience (dev + test + build)
- An encouragment to use standard and **simplest forms of coding**

# Demo

Run the following command to create a demo of a jsenv project on your machine.

```console
npm create jsenv@latest
```

> "web" demos are running tests in headless browsers. If you never have installed playwright on your machine npm install can take a bit of time.

# Installation

```console
npm install --save-dev @jsenv/core
```

_@jsenv/core_ is tested on Mac, Windows, Linux on Node.js 16.14.0. Other operating systems and Node.js versions are not tested.

# Documentation

| Link                                                   | Description                                |
| ------------------------------------------------------ | ------------------------------------------ |
| [Configuration](./docs/configuration/configuration.md) | How to configure jsenv                     |
| [Browser support](./docs/browser_support/readme.md)    | Documentation around browser support       |
| [Assets](./docs/assets/readme.md)                      | How to use assets (CSS, JSON, images, ...) |
| [Web workers](./docs/web_workers/readme.md)            | How to use web workers                     |
| [NPM package](./docs/npm_package/readme.md)            | How to use a NPM package                   |
| [CDN](./docs/cdn/readme.md)                            | How to use ressources from CDN             |
| [React](./docs/react/readme.md)                        | How to enable react (or preact) and JSX    |

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

![jsenv logo with legend](./docs/jsenv-logo-legend.png)

# See also

| Link                                                                                                                     | Description                                                  |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| [@jsenv/template-pwa](https://github.com/jsenv/jsenv-template-pwa)                                                       | GitHub repository template for a progressive web application |
| [@jsenv/template-node-package](https://github.com/jsenv/jsenv-template-node-package)                                     | GitHub repository template for a node package                |
| [@jsenv/assert](https://github.com/jsenv/assert)                                                                         | NPM package to write assertions                              |
| [I am too lazy for a test framework](https://medium.com/@DamienMaillard/i-am-too-lazy-for-a-test-framework-ca08d216ee05) | Article presenting a straightforward testing experience      |
