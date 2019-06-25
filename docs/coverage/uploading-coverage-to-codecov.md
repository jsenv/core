# Uploading `coverage.json` to `codecov.io`

If you don't know how to generate `coverage.json`, check first coverage documentation and come here later.<br />
— see [coverage](./coverage.md)

If you already know how to generate `coverage.json`, this part is dedicated to show how to upload it to `codecov.io`.<br />

## What is `codecov.io`

`codecov.io` is a developper tool helping to manage your project coverage. You have to send them your project coverage as part of your continuous integration process.<br />
By the way, I have no special relationship with them, this documentation just explains how to use it.<br />
— see [codecov.io quick start documentation](https://docs.codecov.io/docs/quick-start).

## How to send them `coverage.json`

There is a dedicated npm package for this task called `@jsenv/codecov-upload`.<br />
Here are the steps to use it:

1. Create an account on `codecov.io`

Go to https://codecov.io

2. Find `Repository Upload Token` for your project

Check the codecov io documentation.<br />
— see https://docs.codecov.io/docs

To help you a bit, if your github user name is `john` and your project is `whatever` you would go to https://codecov.io/gh/john/whatever to get your `Repository Upload Token`.<br />

3. install `@jsenv/codecov-upload`

```shell
npm install --save-dev @jsenv/codecov-upload
```

4. Create a script capable to upload coverage.<br />

`root/upload-coverage.js`

```js
const { uploadCoverage } = require("@jsenv/codecov-upload")

uploadCoverage({
  projectPath: __dirname,
  coverageRelativePath: "/coverage/coverage-final.json",
  token: YOUR_REPOSITORY_UPLOAD_TOKEN,
})
```

5. Run `root/upload-coverage.js` you just created

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
"/coverage/coverage-final.json"
```
