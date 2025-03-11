# dev/

Code implementing jsenv dev server can be found here.

# Description

Jsenv dev server is a file server injecting code into HTML to autoreload when a file is saved.

It uses a plugin pattern allowing to control dev server behaviour

- Plugins can be used to transform file content before serving them; And many more things
- Some plugins are internal to jsenv and can be configured through parameters
- Some plugins are published in their own packages and can be passed via startDevServer "plugins" parameter
