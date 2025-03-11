# plugins/

Code implementing jsenv internal plugins can be found here.

# Description

These plugins can be configured using parameters of "startDevServer" and "build" functions.

A few examples of plugins that can be found here:

- inject code to autoreload during dev
- apply node module resolution on js imports

They are here and not inside a separate NPM package because:

1. they are considered useful enough to be available by default
2. putting them into a separate package would force people to enable a bunch of plugins
   to obtain what they want instead of having sensible defaults
