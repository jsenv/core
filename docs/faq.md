# Troubleshooting

# importMap.json not found

This file presence becomes madatory if you use use `import.meta` in your codebase. Just put an `importMap.json` with `{}` inside if you don't use importmap and want to get rid of this error.

# unmapped bare specifier

You need to remap bare specifier to actual files using an importmap, see [importMapFileRelativeUrl](./shared-parameters.md#importMapFileRelativeUrl).

If you got an importmap maybe it's outdated, and needs to be generated again.

May also occur when one of your dependency `package.json` is not configured properly or with non standard fields. A dependency using `browser` field could cause this for instance https://github.com/jsenv/jsenv-node-module-import-map/issues/16.

# Exploring + https + SSL certificate error + Chrome

Chrome disable cache when the https certificate got an ssl error. https://bugs.chromium.org/p/chromium/issues/detail?id=103875#c3
