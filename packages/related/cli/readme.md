# @jsenv/cli

[![npm package](https://img.shields.io/npm/v/@jsenv/cli.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/cli)

## Overview

_@jsenv/cli_ is a command-line tool for quickly setting up JavaScript projects with jsenv configurations and best practices.

It provides templates for various project types to get you started immediately.

## Installation & Usage

Run the CLI directly with npx:

```console
npx @jsenv/cli
```

> `npx` command is installed with Node.js. If you don't have it, you must [install Node.js](https://nodejs.org/en/download/package-manager).

## Getting Started

The command initializes jsenv in a directory. It can be a new directory or an existing one.

```console
> npx @jsenv/cli
Welcome in jsenv CLI
? Enter a directory: ›
```

## Templates

After specifying a directory, you'll be prompted to select a template:

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

### Available Templates

- **web**: Basic web application with HTML, CSS, and JavaScript
- **web-components**: Project setup for creating reusable web components
- **web-react**: React-based web application configuration
- **web-preact**: Preact-based web application (lighter alternative to React)
- **node-package**: Configuration for creating a Node.js package

A template is a project pre-configured with jsenv. For example, selecting "web" would initialize the [web template](https://github.com/jsenv/core/tree/main/packages/related/cli/template-web):

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

## Next Steps

After initialization:

1. Navigate to your project directory: `cd your-directory`
2. Install dependencies: `npm install`
3. Start the development server: `npm start`
