module.exports = {
  metas: {
    source: {
      "index.js": true,
      "src/**/*.js": true,
      "src/**/*.test.js": false
    },
    test: {
      "index.test.js": true,
      "src/**/*.test.js": true
    },
    prettify: {
      "index.js": true,
      "src/**/*.js": true,
      "bin/**/*.js": true,
      "script/**/*.js": true,
      "**/*.md": true,
      "**/*.json": true,
      "package.json": false,
      "package-lock.json": false
    },
    compile: {
      "index.js": true,
      "src/**/*.js": true,
      "bin/**/*.js": true
    }
  }
};
