module.exports = {
  metas: {
    cover: {
      "index.js": true,
      "src/**/*.js": true,
      // "bin/**/*.js": true,
    },
    watch: {
      // watcher are created on demand when you do an http request to compile server
      // in theory everything you get from server should be watched
      // but we can ignore map files
      "**/*": true,
      // eslint-disable-next-line camelcase
      // node_modules: false,
      "**/*.map": false,
    },
  },
}
