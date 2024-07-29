# @jsenv/cli [![npm package](https://img.shields.io/npm/v/@jsenv/cli.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/cli)

_@jsenv/cli_ is a NPM package meant to run via the command below:

```console
npx @jsenv/cli
```

> If you don't have `npx` command you must [install Node.js](https://nodejs.org/en/download/package-manager)

The command init jsenv in a directory. It can be a new directory or an existing one.

```console
> npx @jsenv/cli
Welcome in jsenv CLI
? Enter a directory: ›
```

Then you'll be prompted to select a template.

```console
> npx @jsenv/cli
✔ Enter a directory: › demo
? Select a template: › - Use arrow-keys. Return to submit.
❯   web
    web-components
    web-react
    web-preact
    node-package
```

A template is a project pre-configured with jsenv.  
Selecting "web" would init [template-web/](./packages/related/cli/template-web/):

```console
> npx @jsenv/cli
✔ Enter a directory: › demo
✔ Select a template: › web
✔ init jsenv in "[...]/demo/" (done in 0.01 second)
----- 3 commands to run -----
cd demo
npm install
npm start
-----------------------------
```
