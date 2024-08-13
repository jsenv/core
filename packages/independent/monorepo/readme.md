# @jsenv/monorepo

Helpers to manage multiple packages from a single repository. For example when using [NPM workspaces](https://docs.npmjs.com/cli/v8/using-npm/workspaces).

This packages helps to perform 2 tasks that are a bit painful to do "by hand" inside a monorepo: "publish a new version" and "upgrade dependencies".

## Publish a new version

Publishing a new version of a package in a monorepo by hand is time consuming and error prone. It's because you have to ensure packages versions are properly updated according to their inter-dependency. Let's see it with a basic example where a monorepo contains two packages and you make a change to one of them.

_packages/main/package.json:_

```json
{
  "name": "main",
  "version": "3.4.2",
  "dependencies": {
    "util": "1.0.0"
  }
}
```

_packages/util/package.json:_

```json
{
  "name": "util",
  "version": "1.0.0"
}
```

Now you update "version" in "packages/util/package.json"

```diff
{
  "name": "util",
- "version": "1.0.0"
+ "version": "1.1.0"
}
```

At this point you are supposed to update "packages/main/package.json" like this:

```diff
{
  "name": "main",
- "version": "3.4.2",
+ "version": "3.4.3",
  "dependencies": {
-   "util": "1.0.0"
+   "util": "1.1.0"
  }
}
```

In a monorepo with many packages this is hard to do correctly and time consuming. You can automate the painful part as follows:

1. Run _syncPackagesVersions_
2. Review changes with a tool like "git diff"
3. Run _publishPackages_

### syncPackagesVersions

_syncPackagesVersions_ is an async function ensuring versions in all package.json are in sync for all packages in the workspace. It update versions in "dependencies", "devDependencies" and increase "version" if needed. This ensure all versions are in sync before publishing.

```js
import { syncPackagesVersions } from "@jsenv/monorepo";

await syncPackagesVersions({
  directoryUrl: new URL("./", import.meta.url),
});
```

### Review changes

Each package might need to increase their package.json "version" differently. When it's required _syncPackagesVersions_ increases PATCH number ("1.0.3" becomes "1.0.4"). After that it's up to you to review these changes to decide if you keep PATCH increment or want to increment MINOR or MAJOR instead.

### publishPackages

_publishPackages_ is an async function that will publish all packages in the monorepo on NPM. But only the packages that are not already published.

```js
import { publishPackages } from "@jsenv/monorepo";

process.env.NPM_TOKEN = "token_auhtorized_to_publish_on_npm";

await publishPackages({
  directoryUrl: new URL("./", import.meta.url),
});
```

## Upgrade dependencies

As a maintainer of a package with many dependencies you periodically want to check if there is new versions of your dependencies to stay up to date. We'll first see what NPM packages are usually doing and why it's a problem. Then we'll see how to avoid that problem. Finally we'll see how to use a function to upgrade dependencies because it can be a bit time consuming to do by hand.

NPM introduced what usage of ^ or "\*" in your _package.json_.

```json
{
  "dependencies": {
    "foo": "^1.0.0"
  }
}
```

But it causes a problem.

### The problem

As a result "npm install" auto updates to latest versions if any is found. In the end any npm install can change the behaviour of your code if a new version was published since the last npm install.

The sequence of events looks as below

```console
[7h00] npm install
[7h01] npm downloads `foo@1.1.0`
[7h30] `foo@1.2.0` is published on NPM
[8h00] npm install
[8h01] npm downloads `foo@1.2.0`
```

Whenever you or someone else ends up with foo version `1.2.0` it can break the code or lead to different code behaviour. People will loose time trying to understand what's going on only to realize it comes from the new version.

### But package-lock.json fixes that right?

_package-lock.json_ fixes that but only if you run `npm ci`.
And people are still used to start a project using `npm install + npm start`.

The problem is that `npm install` does too many things.
Most of the time you don't want to update your deps. The 2 most common scenarios are:

- "I want want to install deps on a fresh project"
- "I want to ensure my deps are in sync after git pull in a branch"

"I want to update all my deps" happens from time to time but is usually not what you had in mind before executing "npm install"

Moreover the usage of _package-lock.json_ remains optional.  
And _package-lock.json_ can be problematic https://github.com/npm/cli/issues/4828, some project disable package-lock to avoid these kind of issues until the situation becomes better.

## How to avoid the problem

Use explicit version in the package.json

BAD

```json
{
  "dependencies": {
    "foo": "^1.0.0",
    "bar": "2.*"
  }
}
```

GOOD

```json
{
  "dependencies": {
    "foo": "1.1.3",
    "bar": "2.0.0"
  }
}
```

As a result there is no ambiguity on the version being used and we know the exact version in the glimpse of an eye.
**You control when the version gets updated**

Once versions are fixed you can update whenever you want by running "npm outdated" and decide what to update by hand.

But inside large codebases with a lot of packages this process takes time, you can use the following function to perform "npm outdated" + update the versions in the package.json

```js
import { upgradeExternalVersions } from "@jsenv/monorepo";

await upgradeExternalVersions({
  directoryUrl: new URL("./", import.meta.url),
});
```
