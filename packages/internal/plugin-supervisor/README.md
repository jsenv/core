This plugin has its own package because:

- It's a direct dependency of `@jsenv/core` but it is easier to reason about this code when its properly splitted in its own package
- `@jsenv/test` use most of the logic of this plugin. Having a dedicated NPM package allow to reuse that code without creating a direct dependency between `@jsenv/test` and `@jsenv/core`.
