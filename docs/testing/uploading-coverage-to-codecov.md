TODO: move this in @jsenv/codecov-upload

# Table of contents

- [Presentation](#Presentation)
- [Installation](#Installation)
  - [Step 1 - Setup basic project](#step-1---setup-basic-project)
  - [Step 2 - Find your CODECOV_TOKEN](#step-2---find-your-codecov_token)
  - [Step 3 - Install @jsenv/codecov-upload](#step-3---install--jsenvcodecov-upload)
  - [Step 4 - Create js file to upload coverage](#step-4---create-js-file-to-upload-coverage)
  - [Step 5 - Upload your coverage](#step-5---upload-coverage-your-coverage)

# Presentation

This document describes how to upload your coverage to `codecov.io` to track your project coverage evolution.

`codecov.io` is a developper tool helping to manage your project coverage. You have to send them your project coverage as part of your continuous integration workflow.<br />
— see [codecov.io quick start documentation](https://docs.codecov.io/docs/quick-start).

Note: This documentation explains how to use codecov.io but jsenv has no privilegied relationship with them.

# Installation

There is a dedicated npm package for this task called `@jsenv/codecov-upload`.<br />
Here are the steps to use it:

## Step 1 - Create an account on `codecov.io`

Go to https://codecov.io

## Step 2 - Find your CODECOV_TOKEN

Find `Repository Upload Token` for your project

Check the codecov io documentation.<br />
— see https://docs.codecov.io/docs

To help you a bit, if your github user name is `john` and your project is `whatever` you would go to https://codecov.io/gh/john/whatever to get your `Repository Upload Token`.<br />

### Step 3 - Install @jsenv/codecov-upload

```shell
npm install --save-dev @jsenv/codecov-upload@1.6.0
```

### Step 4 - Create js file to upload coverage

Create a script capable to upload coverage.

`upload-coverage.js`

```js
const { uploadCoverage } = require("@jsenv/codecov-upload")

uploadCoverage({
  projectDirectoryPath: __dirname,
  coverageJsonFileRelativePath: "./coverage/coverage.json",
})
```

### Step 5 - Upload your coverage

Ensure process.env.CODECOV_TOKEN will exists and run `upload-coverage.js`.

It will send coverage to `codecov.io`

### `uploadCoverage` options

### token

If you don't pass this option, the default value will be:

```js
process.env.CODECOV_TOKEN
```

Your token is a sensitive information that should not be kept public.<br />
By default `uploadCoverage` will try to read it from `process.env.CODECOV_TOKEN`.<br />
It means you have to set this value somehow before running the script.<br />

For example, if you use travis you would go to `https://travis-ci.com/john/whatever/settings` in the `Environment Variables` section and add a `CODECOV_TOKEN` variable.

### coverageRelativePath

If you don't pass this option, the default value will be:

```js
"./coverage/coverage.json"
```
