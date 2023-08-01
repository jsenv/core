Welcome in jsenv documentation for users!

This documentation is adressed to people using jsenv for the first time or already using it.

# 1. Scope

The scope of jsenv is the set of situation where jsenv will be used to perform a task:

- executing source file(s)
- executing a single test
- executing all tests
- build source files for production
- executing build files

Jsenv scope is large, meaning you have less tools to use and to maintain. It leads to a consistent dev experience where switching from a type of task to an other is quick and easy.

# 2. Standard

Jsenv promotes standards and does not impose any constraints on your files or the code written inside. This helps your code to be portable to other environment(s).

One of the main strengh of jsenv, relying on standard, is the ablity to have multiple HTML file in your source code. This flexibility allows to:

- Have more than one entry point
- Experiment things in independent files
- Create interactive documentation about your UI
- Write tests directly inside HTML files
- Many more things

# 3. Directory structure

Let's examine the directory structure of a project using jsenv.

```console
project/ -> root directory
  dist/ -> build files will be written here
  scripts/ -> script files goes here
  src/ -> sources files goes here
  package.json
```

This is just an example, jsenv can be used on any directory structure.

A typical web project would have at least the following files:

```console
project/
  dist/
    index.html
  scripts/
    build.mjs
    dev.mjs
    test.mjs
  src/
    index.html
  package.json
```

`scripts/*` can be executed directly with node.

```console
node ./scripts/dev.mjs
```

In general it's recommended to run these commands via NPM. To achieve this, commands can be aliased in _package.json_:

```json
"scripts": {
  "dev": "node ./scripts/dev.mjs",
  "build": "node ./scripts/build.mjs",
  "test": "node ./scripts/test.mjs"
}
```

Then runned using NPM:

```console
npm run dev
npm run build
npm run test
```

☝️ Others parts of the documentation will use NPM to run commands.

<table>
 <tr>
  <td width="2000px" align="left" nowrap>
   <a href="../../readme.md">< Home</a>
  </td>
  <td width="2000px" align="right" nowrap>
   <a href="./b_dev.md">> B) Dev</a>
  </td>
 </tr>
<table>
