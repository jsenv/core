## How to use

To understand how to use jsenv testing let's use it on a "real" project.<br /> We will setup a basic project and execute tests, then see how to get test coverage.

### Basic project setup

1. Create basic project file structure

   — see [./docs/basic-project](./docs/basic-project)

2. Install dev dependencies

   ```console
   npm install
   ```

### `test` example

```console
node ./execute-tests.js
```

I made a video recording terminal during execution `basic-project/execute-tests.js`. The gif below was generated from that video.

![test terminal recording](./docs/test-terminal-recording.gif)

Cool isn't it?

If you want to know more about `test`, there is a dedicated page for that.<br />
— see [`test` documentation](./docs/test-doc.md)

From this point you can generate coverage for that basic project.<br />
If you are interested by this, it is explained in the next part.

### `cover` example

```console
node ./generate-coverage.js
```

It will execute tests and generate `basic-project/coverage/coverage-final.json`.

I made a gif to illustrate one thing you can get after generating basic project coverage. You can see me exploring the files to see coverage of `basic-project/src/platform-name.js`.<br />

![browsing coverage recording](./docs/coverage-browsing-recording.gif)

These files will be generated only if you pass `coverageHtmlReport: true` to `cover`.

#### What is `coverage-final.json` ?

At this point you have a `basic-project/coverage/coverage-final.json` file. You can pass it to a code coverage tool and get valuable information from it.<br />

It's important to know that `coverage-final.json` format comes from `instanbul`.<br />
— see [istanbul on github](https://github.com/gotwarlost/istanbul)

The most valuable thing to do with that file is to feed it to some code coverage tool during your continuous integration script.
I have documented one of them named `codecov.io` but you can integrate with pretty much anything else.<br />
— see [uploading coverage to codecov.io](./docs/uploading-coverage-to-codecov.md)

### `startContinuousTesting` example

To be documented, in any case it's an experimental for now.
