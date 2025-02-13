<!-- inspired from https://github.com/github/docs/blob/main/contributing/development.md -->

# Development

This document describes the process for running this application on your local computer.

# Setup

**Operating System**: Mac, Linux or Windows.

**Command line tools**:

- [git](https://git-scm.com/) version 2.26.0 or above
- [node](https://nodejs.org/en/) version 14.17.0 or above

Then, run the following commands:

```console
git clone git@github.com:jsenv/jsenv-template-node-package.git
```

```console
cd ./jsenv-template-node-package
```

```console
npm install
```

# Contribution lifecycle

Expected steps from the moment you start coding to the moment it gets merged on the main branch.

It's not strictly necessary to run ESLint, prettier, tests locally while developing: You can always open a pull request and rely on the GitHub workflow to run them for you, but it's recommended to run them locally before pushing your changes.

Create a branch

```console
git checkout -b branch-name
```

Open your code editor (VSCode for example)

```console
code .
```

Do your changes, create your commits and push them whenever you want

```console
git commit -m "commit message"
git push
```

Create a pull request as documented in [Creating a pull request](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/creating-a-pull-request). Feel free to create [draft pull request](https://github.blog/2019-02-14-introducing-draft-pull-requests/) and put it as ready for review when you are done.
