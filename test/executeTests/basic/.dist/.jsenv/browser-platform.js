(function () {
  'use strict';

  var compileIntoRelativePath = "/test/testing/basic/.dist";
  var groupMap = {
    "best": {
      "babelPluginRequiredNameArray": ["proposal-json-strings", "proposal-optional-catch-binding", "proposal-unicode-property-regex", "syntax-object-rest-spread", "syntax-optional-catch-binding", "transform-dotall-regex"],
      "jsenvPluginRequiredNameArray": [],
      "platformCompatMap": {
        "chrome": "60",
        "firefox": "55",
        "electron": "2.1",
        "opera": "47",
        "node": "8.3"
      }
    },
    "otherwise": {
      "babelPluginRequiredNameArray": ["proposal-object-rest-spread", "proposal-optional-catch-binding", "proposal-unicode-property-regex", "proposal-json-strings", "syntax-object-rest-spread", "syntax-optional-catch-binding", "transform-async-to-promises", "transform-arrow-functions", "transform-block-scoped-functions", "transform-block-scoping", "transform-classes", "transform-computed-properties", "transform-destructuring", "transform-dotall-regex", "transform-duplicate-keys", "transform-exponentiation-operator", "transform-for-of", "transform-function-name", "transform-literals", "transform-new-target", "transform-object-super", "transform-parameters", "transform-regenerator", "transform-shorthand-properties", "transform-spread", "transform-sticky-regex", "transform-template-literals", "transform-typeof-symbol", "transform-unicode-regex"],
      "jsenvPluginRequiredNameArray": [],
      "platformCompatMap": {}
    }
  };
  var importDefaultExtension = undefined;

  var importMap = {
    "imports": {
      "@jsenv/core/": "/node_modules/@jsenv/core/",
      "@babel/plugin-syntax-dynamic-import": "./node_modules/@babel/plugin-syntax-dynamic-import/lib/index.js",
      "@babel/plugin-transform-react-jsx": "./node_modules/@babel/plugin-transform-react-jsx/lib/index.js",
      "@babel/plugin-syntax-import-meta": "./node_modules/@babel/plugin-syntax-import-meta/lib/index.js",
      "@jsenv/node-module-import-map": "./node_modules/@jsenv/node-module-import-map/index.js",
      "@jsenv/prettier-check-project": "./node_modules/@jsenv/prettier-check-project/index.js",
      "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
      "@dmail/filesystem-matching": "./node_modules/@dmail/filesystem-matching/index.js",
      "@jsenv/commonjs-converter": "./node_modules/@jsenv/commonjs-converter/index.js",
      "@jsenv/chromium-launcher": "./node_modules/@jsenv/chromium-launcher/index.js",
      "@dmail/filesystem-watch": "./node_modules/@dmail/filesystem-watch/index.js",
      "@jsenv/babel-plugin-map": "./node_modules/@jsenv/babel-plugin-map/index.js",
      "istanbul-lib-instrument": "./node_modules/istanbul-lib-instrument/dist/index.js",
      "@jsenv/compile-server/": "./node_modules/@jsenv/compile-server/",
      "@jsenv/prettier-config": "./node_modules/@jsenv/prettier-config/index.js",
      "@jsenv/codecov-upload": "./node_modules/@jsenv/codecov-upload/index.js",
      "@jsenv/compile-server": "./node_modules/@jsenv/compile-server/index.js",
      "istanbul-lib-coverage": "./node_modules/istanbul-lib-coverage/index.js",
      "@jsenv/eslint-config": "./node_modules/@jsenv/eslint-config/index.js",
      "@jsenv/node-launcher": "./node_modules/@jsenv/node-launcher/index.js",
      "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
      "istanbul-lib-report": "./node_modules/istanbul-lib-report/index.js",
      "@jsenv/execution": "./node_modules/@jsenv/execution/index.js",
      "istanbul-reports": "./node_modules/istanbul-reports/index.js",
      "@jsenv/bundling": "./node_modules/@jsenv/bundling/index.js",
      "@jsenv/url-meta": "./node_modules/@jsenv/url-meta/index.js",
      "@jsenv/testing": "./node_modules/@jsenv/testing/index.js",
      "@dmail/assert": "./node_modules/@dmail/assert/index.js",
      "@dmail/helper": "./node_modules/@dmail/helper/index.js",
      "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
      "node-notifier": "./node_modules/node-notifier/index.js",
      "@jsenv/href/": "./node_modules/@jsenv/href/",
      "babel-eslint": "./node_modules/babel-eslint/lib/index.js",
      "@babel/core": "./node_modules/@babel/core/lib/index.js",
      "@jsenv/href": "./node_modules/@jsenv/href/index.js",
      "node-fetch": "./node_modules/node-fetch/lib/index.mjs",
      "prettier": "./node_modules/prettier/index.js",
      "eslint": "./node_modules/eslint/lib/api.js",
      "rimraf": "./node_modules/rimraf/rimraf.js",
      "react": "./node_modules/react/index.js",
      "cuid": "./node_modules/cuid/index.js"
    },
    "scopes": {
      "./node_modules/@jsenv/compile-server/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/import-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/href": "./node_modules/@jsenv/compile-server/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/import-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/href": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/import-map/node_modules/@jsenv/operating-system-path/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/href": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/error-stack-sourcemap/node_modules/@jsenv/operating-system-path/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/href": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/error-stack-sourcemap/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/compile-server/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
        "@jsenv/import-map": "./node_modules/@jsenv/compile-server/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/import-map/index.js",
        "@dmail/helper": "./node_modules/@dmail/helper/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
        "@jsenv/import-map": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/import-map/index.js",
        "@dmail/helper": "./node_modules/@dmail/helper/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/import-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/href": "./node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/operating-system-path/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/href": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/operating-system-path/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/url-meta/node_modules/@jsenv/import-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/href": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/url-meta/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/import-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/import-map/node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/href": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/logger/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/href": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/logger/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/operating-system-path/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/href": "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/prettier-check-project/node_modules/@jsenv/operating-system-path/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/href": "./node_modules/@jsenv/prettier-check-project/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/commonjs-converter/node_modules/babel-plugin-transform-commonjs/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@dmail/filesystem-matching/node_modules/@jsenv/operating-system-path/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/href": "./node_modules/@dmail/filesystem-matching/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/commonjs-converter/node_modules/@jsenv/operating-system-path/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/href": "./node_modules/@jsenv/commonjs-converter/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@dmail/filesystem-watch/node_modules/@jsenv/operating-system-path/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/href": "./node_modules/@dmail/filesystem-watch/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/error-stack-sourcemap/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/error-stack-sourcemap/node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/href": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/error-stack-sourcemap/node_modules/@jsenv/href/index.js",
        "source-map": "./node_modules/@jsenv/node-launcher/node_modules/source-map/source-map.js",
        "/": "/"
      },
      "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/import-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/href": "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/import-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/href": "./node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
        "@jsenv/import-map": "./node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/import-map/index.js",
        "@dmail/helper": "./node_modules/@dmail/helper/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/prettier-check-project/node_modules/@jsenv/url-meta/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/import-map": "./node_modules/@jsenv/import-map/index.js",
        "/": "/"
      },
      "./node_modules/@babel/helper-builder-binary-assignment-operator-visitor/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-explode-assignable-expression": "./node_modules/@babel/helper-explode-assignable-expression/lib/index.js",
        "@babel/types": "./node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/logger/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/href": "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/logger/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/href": "./node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/logger/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@dmail/filesystem-matching/node_modules/@jsenv/url-meta/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/import-map": "./node_modules/@jsenv/import-map/index.js",
        "/": "/"
      },
      "./node_modules/@dmail/server/node_modules/@jsenv/operating-system-path/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/href": "./node_modules/@dmail/server/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/chromium-launcher/node_modules/@jsenv/import-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/href/": "./node_modules/@jsenv/href/",
        "@jsenv/href": "./node_modules/@jsenv/href/index.js"
      },
      "./node_modules/@dmail/filesystem-watch/node_modules/@jsenv/url-meta/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/import-map": "./node_modules/@jsenv/import-map/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/compile-server/node_modules/@jsenv/import-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/href/": "./node_modules/@jsenv/href/",
        "@jsenv/href": "./node_modules/@jsenv/href/index.js"
      },
      "./node_modules/rollup-plugin-node-globals/node_modules/magic-string/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "vlq": "./node_modules/vlq/src/vlq.js"
      },
      "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/import-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/href/": "./node_modules/@jsenv/href/",
        "@jsenv/href": "./node_modules/@jsenv/href/index.js"
      },
      "./node_modules/@jsenv/compile-server/node_modules/@jsenv/bundling/": {
        "@jsenv/core/": "./node_modules/@jsenv/core/",
        "@jsenv/node-module-import-map": "./node_modules/@jsenv/compile-server/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/index.js",
        "@babel/helper-module-imports": "./node_modules/@babel/helper-module-imports/lib/index.js",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/babel-plugin-map": "./node_modules/@jsenv/babel-plugin-map/index.js",
        "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
        "@jsenv/import-map/": "./node_modules/@jsenv/compile-server/node_modules/@jsenv/import-map/",
        "@jsenv/import-map": "./node_modules/@jsenv/compile-server/node_modules/@jsenv/import-map/index.js",
        "abort-controller": "./node_modules/abort-controller/dist/abort-controller.js",
        "@dmail/helper": "./node_modules/@dmail/helper/index.js",
        "@dmail/server": "./node_modules/@dmail/server/index.js",
        "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
        "@jsenv/href/": "./node_modules/@jsenv/href/",
        "@jsenv/core": "./node_modules/@jsenv/core/index.js",
        "@jsenv/href": "./node_modules/@jsenv/href/index.js",
        "node-fetch": "./node_modules/node-fetch/lib/index.mjs",
        "rollup": "./node_modules/@jsenv/compile-server/node_modules/rollup/dist/rollup.es.js",
        "terser": "./node_modules/terser/dist/bundle.min.js",
        "/": "/"
      },
      "./node_modules/@jsenv/node-launcher/node_modules/@babel/template/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
        "@babel/parser": "./node_modules/@jsenv/node-launcher/node_modules/@babel/parser/lib/index.js",
        "@babel/types": "./node_modules/@jsenv/node-launcher/node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/bundling/": {
        "@jsenv/core/": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/",
        "@jsenv/node-module-import-map": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/index.js",
        "@babel/helper-module-imports": "./node_modules/@babel/helper-module-imports/lib/index.js",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/babel-plugin-map": "./node_modules/@jsenv/babel-plugin-map/index.js",
        "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
        "@jsenv/import-map/": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/import-map/",
        "@jsenv/import-map": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/import-map/index.js",
        "abort-controller": "./node_modules/abort-controller/dist/abort-controller.js",
        "@dmail/helper": "./node_modules/@dmail/helper/index.js",
        "@dmail/server": "./node_modules/@dmail/server/index.js",
        "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
        "@jsenv/href/": "./node_modules/@jsenv/href/",
        "@jsenv/core": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/index.js",
        "@jsenv/href": "./node_modules/@jsenv/href/index.js",
        "node-fetch": "./node_modules/node-fetch/lib/index.mjs",
        "rollup": "./node_modules/rollup/dist/rollup.es.js",
        "terser": "./node_modules/terser/dist/bundle.min.js",
        "/": "/"
      },
      "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/url-meta/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/import-map": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/url-meta/node_modules/@jsenv/import-map/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/babel-plugin-map/node_modules/@babel/core/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "convert-source-map": "./node_modules/convert-source-map/index.js",
        "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
        "@babel/generator": "./node_modules/@babel/generator/lib/index.js",
        "@babel/template": "./node_modules/@babel/template/lib/index.js",
        "@babel/traverse": "./node_modules/@babel/traverse/lib/index.js",
        "@babel/helpers": "./node_modules/@babel/helpers/lib/index.js",
        "@babel/parser": "./node_modules/@babel/parser/lib/index.js",
        "@babel/types": "./node_modules/@babel/types/lib/index.js",
        "source-map": "./node_modules/source-map/source-map.js",
        "resolve": "./node_modules/resolve/index.js",
        "lodash": "./node_modules/lodash/lodash.js",
        "semver": "./node_modules/semver/semver.js",
        "debug": "./node_modules/debug/src/index.js",
        "json5": "./node_modules/json5/lib/index.js"
      },
      "./node_modules/@jsenv/node-launcher/node_modules/@babel/helpers/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/template": "./node_modules/@jsenv/node-launcher/node_modules/@babel/template/lib/index.js",
        "@babel/traverse": "./node_modules/@babel/traverse/lib/index.js",
        "@babel/types": "./node_modules/@jsenv/node-launcher/node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/@babel/plugin-transform-exponentiation-operator/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-builder-binary-assignment-operator-visitor": "./node_modules/@babel/helper-builder-binary-assignment-operator-visitor/lib/index.js",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/istanbul-lib-report/node_modules/supports-color/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "has-flag": "./node_modules/istanbul-lib-report/node_modules/has-flag/index.js"
      },
      "./node_modules/@babel/plugin-transform-block-scoped-functions/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@jsenv/bundling/node_modules/@jsenv/import-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/href/": "./node_modules/@jsenv/href/",
        "@jsenv/href": "./node_modules/@jsenv/href/index.js"
      },
      "./node_modules/@jsenv/node-launcher/node_modules/@babel/types/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "to-fast-properties": "./node_modules/to-fast-properties/index.js",
        "esutils": "./node_modules/esutils/lib/utils.js",
        "lodash": "./node_modules/lodash/lodash.js"
      },
      "./node_modules/@jsenv/url-meta/node_modules/@jsenv/import-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/href": "./node_modules/@jsenv/url-meta/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/eslint-import-resolver-node/node_modules/debug/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "ms": "./node_modules/eslint-import-resolver-node/node_modules/ms/index.js"
      },
      "./node_modules/@babel/plugin-proposal-optional-catch-binding/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/plugin-syntax-optional-catch-binding": "./node_modules/@babel/plugin-syntax-optional-catch-binding/lib/index.js",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@babel/plugin-proposal-unicode-property-regex/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/helper-regex": "./node_modules/@babel/helper-regex/lib/index.js",
        "regexpu-core": "./node_modules/regexpu-core/rewrite-pattern.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@jsenv/commonjs-converter/node_modules/rollup/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "acorn": "./node_modules/acorn/dist/acorn.mjs"
      },
      "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/plugin-transform-modules-systemjs": "./node_modules/@babel/plugin-transform-modules-systemjs/lib/index.js",
        "@babel/plugin-syntax-dynamic-import": "./node_modules/@babel/plugin-syntax-dynamic-import/lib/index.js",
        "@babel/plugin-syntax-import-meta": "./node_modules/@babel/plugin-syntax-import-meta/lib/index.js",
        "babel-plugin-transform-commonjs": "./node_modules/babel-plugin-transform-commonjs/dist/index.js",
        "@babel/helper-hoist-variables": "./node_modules/@babel/helper-hoist-variables/lib/index.js",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/operating-system-path/index.js",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@jsenv/babel-plugin-map": "./node_modules/@jsenv/babel-plugin-map/index.js",
        "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
        "regenerator-runtime": "./node_modules/regenerator-runtime/runtime.js",
        "@jsenv/import-map": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/import-map/index.js",
        "@jsenv/url-meta": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/url-meta/index.js",
        "proper-lockfile": "./node_modules/proper-lockfile/index.js",
        "@babel/helpers": "./node_modules/@jsenv/node-launcher/node_modules/@babel/helpers/lib/index.js",
        "@dmail/helper": "./node_modules/@dmail/helper/index.js",
        "@jsenv/logger": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/logger/index.js",
        "ansi-to-html": "./node_modules/ansi-to-html/lib/ansi_to_html.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js",
        "@jsenv/href": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/node_modules/@jsenv/href/index.js",
        "rimraf": "./node_modules/rimraf/rimraf.js",
        "/": "/"
      },
      "./node_modules/@babel/helper-member-expression-to-functions/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/types": "./node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/@babel/helpers/node_modules/@babel/generator/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/types": "./node_modules/@babel/helpers/node_modules/@babel/types/lib/index.js",
        "source-map": "./node_modules/source-map/source-map.js",
        "lodash": "./node_modules/lodash/lodash.js",
        "jsesc": "./node_modules/jsesc/jsesc.js"
      },
      "./node_modules/@babel/plugin-transform-shorthand-properties/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@babel/helper-explode-assignable-expression/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/traverse": "./node_modules/@babel/traverse/lib/index.js",
        "@babel/types": "./node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/@babel/helpers/node_modules/@babel/template/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
        "@babel/parser": "./node_modules/@babel/helpers/node_modules/@babel/parser/lib/index.js",
        "@babel/types": "./node_modules/@babel/helpers/node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/@babel/helpers/node_modules/@babel/traverse/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-split-export-declaration": "./node_modules/@babel/helper-split-export-declaration/lib/index.js",
        "@babel/helper-function-name": "./node_modules/@babel/helper-function-name/lib/index.js",
        "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
        "@babel/generator": "./node_modules/@babel/helpers/node_modules/@babel/generator/lib/index.js",
        "@babel/parser": "./node_modules/@babel/helpers/node_modules/@babel/parser/lib/index.js",
        "@babel/types": "./node_modules/@babel/helpers/node_modules/@babel/types/lib/index.js",
        "globals": "./node_modules/globals/index.js",
        "lodash": "./node_modules/lodash/lodash.js",
        "debug": "./node_modules/debug/src/index.js"
      },
      "./node_modules/@babel/plugin-syntax-optional-catch-binding/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@babel/plugin-transform-computed-properties/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/level-sublevel/node_modules/level-fix-range/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "clone": "./node_modules/clone/clone.js"
      },
      "./node_modules/@babel/generator/node_modules/@babel/types/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "to-fast-properties": "./node_modules/to-fast-properties/index.js",
        "esutils": "./node_modules/esutils/lib/utils.js",
        "lodash": "./node_modules/lodash/lodash.js"
      },
      "./node_modules/@jsenv/core/node_modules/@jsenv/import-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/href/": "./node_modules/@jsenv/href/",
        "@jsenv/href": "./node_modules/@jsenv/href/index.js"
      },
      "./node_modules/@babel/core/node_modules/@babel/generator/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/types": "./node_modules/@babel/core/node_modules/@babel/types/lib/index.js",
        "source-map": "./node_modules/source-map/source-map.js",
        "lodash": "./node_modules/lodash/lodash.js",
        "jsesc": "./node_modules/jsesc/jsesc.js"
      },
      "./node_modules/@babel/plugin-proposal-object-rest-spread/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/plugin-syntax-object-rest-spread": "./node_modules/@babel/plugin-syntax-object-rest-spread/lib/index.js",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@babel/plugin-transform-template-literals/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-annotate-as-pure": "./node_modules/@babel/helper-annotate-as-pure/lib/index.js",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@babel/traverse/node_modules/@babel/types/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "to-fast-properties": "./node_modules/to-fast-properties/index.js",
        "esutils": "./node_modules/esutils/lib/utils.js",
        "lodash": "./node_modules/lodash/lodash.js"
      },
      "./node_modules/@jsenv/compile-server/node_modules/rollup/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "acorn": "./node_modules/@jsenv/compile-server/node_modules/acorn/dist/acorn.mjs"
      },
      "./node_modules/eslint-plugin-react/node_modules/doctrine/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "esutils": "./node_modules/esutils/lib/utils.js"
      },
      "./node_modules/@babel/core/node_modules/@babel/template/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
        "@babel/parser": "./node_modules/@babel/core/node_modules/@babel/parser/lib/index.js",
        "@babel/types": "./node_modules/@babel/core/node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/@babel/core/node_modules/@babel/traverse/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-split-export-declaration": "./node_modules/@babel/helper-split-export-declaration/lib/index.js",
        "@babel/helper-function-name": "./node_modules/@babel/helper-function-name/lib/index.js",
        "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
        "@babel/generator": "./node_modules/@babel/core/node_modules/@babel/generator/lib/index.js",
        "@babel/parser": "./node_modules/@babel/core/node_modules/@babel/parser/lib/index.js",
        "@babel/types": "./node_modules/@babel/core/node_modules/@babel/types/lib/index.js",
        "globals": "./node_modules/globals/index.js",
        "lodash": "./node_modules/lodash/lodash.js",
        "debug": "./node_modules/debug/src/index.js"
      },
      "./node_modules/@babel/helpers/node_modules/@babel/types/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "to-fast-properties": "./node_modules/to-fast-properties/index.js",
        "esutils": "./node_modules/esutils/lib/utils.js",
        "lodash": "./node_modules/lodash/lodash.js"
      },
      "./node_modules/@babel/plugin-transform-modules-systemjs/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "babel-plugin-dynamic-import-node": "./node_modules/babel-plugin-dynamic-import-node/lib/index.js",
        "@babel/helper-hoist-variables": "./node_modules/@babel/helper-hoist-variables/lib/index.js",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@dmail/server/node_modules/@jsenv/logger/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/href": "./node_modules/@dmail/server/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/core/node_modules/@babel/template/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
        "@babel/parser": "./node_modules/@jsenv/core/node_modules/@babel/parser/lib/index.js",
        "@babel/types": "./node_modules/@jsenv/core/node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/level-blobs/node_modules/readable-stream/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "string_decoder": "./node_modules/level-blobs/node_modules/string_decoder/index.js",
        "core-util-is": "./node_modules/core-util-is/lib/util.js",
        "inherits": "./node_modules/inherits/inherits.js",
        "isarray": "./node_modules/level-blobs/node_modules/isarray/index.js"
      },
      "./node_modules/@babel/plugin-syntax-object-rest-spread/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@babel/plugin-transform-arrow-functions/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@jsenv/core/node_modules/@babel/helpers/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/template": "./node_modules/@jsenv/core/node_modules/@babel/template/lib/index.js",
        "@babel/traverse": "./node_modules/@babel/traverse/lib/index.js",
        "@babel/types": "./node_modules/@jsenv/core/node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/eslint-plugin-import/node_modules/debug/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "ms": "./node_modules/eslint-plugin-import/node_modules/ms/index.js"
      },
      "./node_modules/fwd-stream/node_modules/readable-stream/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "string_decoder": "./node_modules/fwd-stream/node_modules/string_decoder/index.js",
        "core-util-is": "./node_modules/core-util-is/lib/util.js",
        "inherits": "./node_modules/inherits/inherits.js",
        "isarray": "./node_modules/fwd-stream/node_modules/isarray/index.js"
      },
      "./node_modules/level-sublevel/node_modules/object-keys/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "foreach": "./node_modules/foreach/index.js",
        "indexof": "./node_modules/indexof/index.js",
        "is": "./node_modules/is/index.js"
      },
      "./node_modules/@babel/helper-optimise-call-expression/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/types": "./node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/@babel/helper-split-export-declaration/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/types": "./node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/@babel/plugin-transform-duplicate-keys/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/eslint-module-utils/node_modules/debug/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "ms": "./node_modules/eslint-module-utils/node_modules/ms/index.js"
      },
      "./node_modules/@babel/core/node_modules/@babel/types/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "to-fast-properties": "./node_modules/to-fast-properties/index.js",
        "esutils": "./node_modules/esutils/lib/utils.js",
        "lodash": "./node_modules/lodash/lodash.js"
      },
      "./node_modules/@babel/plugin-transform-block-scoping/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js",
        "lodash": "./node_modules/lodash/lodash.js"
      },
      "./node_modules/@babel/plugin-transform-destructuring/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@babel/plugin-transform-function-name/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-function-name": "./node_modules/@babel/helper-function-name/lib/index.js",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@babel/plugin-transform-typeof-symbol/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@babel/plugin-transform-unicode-regex/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/helper-regex": "./node_modules/@babel/helper-regex/lib/index.js",
        "regexpu-core": "./node_modules/regexpu-core/rewrite-pattern.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@jsenv/core/node_modules/@babel/types/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "to-fast-properties": "./node_modules/to-fast-properties/index.js",
        "esutils": "./node_modules/esutils/lib/utils.js",
        "lodash": "./node_modules/lodash/lodash.js"
      },
      "./node_modules/@babel/plugin-transform-dotall-regex/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/helper-regex": "./node_modules/@babel/helper-regex/lib/index.js",
        "regexpu-core": "./node_modules/regexpu-core/rewrite-pattern.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@babel/plugin-transform-object-super/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-replace-supers": "./node_modules/@babel/helper-replace-supers/lib/index.js",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@babel/plugin-transform-sticky-regex/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/helper-regex": "./node_modules/@babel/helper-regex/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/https-proxy-agent/node_modules/debug/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "ms": "./node_modules/ms/index.js"
      },
      "./node_modules/levelup/node_modules/readable-stream/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "string_decoder": "./node_modules/levelup/node_modules/string_decoder/index.js",
        "core-util-is": "./node_modules/core-util-is/lib/util.js",
        "inherits": "./node_modules/inherits/inherits.js",
        "isarray": "./node_modules/levelup/node_modules/isarray/index.js"
      },
      "./node_modules/string-width/node_modules/strip-ansi/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "ansi-regex": "./node_modules/ansi-regex/index.js"
      },
      "./node_modules/@babel/plugin-proposal-json-strings/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/plugin-syntax-json-strings": "./node_modules/@babel/plugin-syntax-json-strings/lib/index.js",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@babel/plugin-syntax-dynamic-import/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@babel/plugin-transform-regenerator/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "regenerator-transform": "./node_modules/regenerator-transform/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@babel/plugin-transform-new-target/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@babel/plugin-transform-parameters/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-get-function-arity": "./node_modules/@babel/helper-get-function-arity/lib/index.js",
        "@babel/helper-call-delegate": "./node_modules/@babel/helper-call-delegate/lib/index.js",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@babel/plugin-syntax-json-strings/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@babel/plugin-transform-react-jsx/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-builder-react-jsx": "./node_modules/@babel/helper-builder-react-jsx/lib/index.js",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/plugin-syntax-jsx": "./node_modules/@babel/plugin-syntax-jsx/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/level-sublevel/node_modules/xtend/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "object-keys": "./node_modules/level-sublevel/node_modules/object-keys/index.js",
        "is-object": "./node_modules/is-object/index.js"
      },
      "./node_modules/unicode-match-property-ecmascript/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "unicode-canonical-property-names-ecmascript": "./node_modules/unicode-canonical-property-names-ecmascript/index.js",
        "unicode-property-aliases-ecmascript": "./node_modules/unicode-property-aliases-ecmascript/index.js"
      },
      "./node_modules/@babel/helper-get-function-arity/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/types": "./node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/@babel/plugin-syntax-import-meta/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@babel/plugin-transform-literals/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/babel-plugin-dynamic-import-node/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "object.assign": "./node_modules/object.assign/index.js"
      },
      "./node_modules/eslint/node_modules/eslint-scope/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "estraverse": "./node_modules/estraverse/estraverse.js",
        "esrecurse": "./node_modules/esrecurse/esrecurse.js"
      },
      "./node_modules/@babel/helper-builder-react-jsx/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/types": "./node_modules/@babel/types/lib/index.js",
        "esutils": "./node_modules/esutils/lib/utils.js"
      },
      "./node_modules/@babel/plugin-transform-classes/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-optimise-call-expression": "./node_modules/@babel/helper-optimise-call-expression/lib/index.js",
        "@babel/helper-split-export-declaration": "./node_modules/@babel/helper-split-export-declaration/lib/index.js",
        "@babel/helper-annotate-as-pure": "./node_modules/@babel/helper-annotate-as-pure/lib/index.js",
        "@babel/helper-replace-supers": "./node_modules/@babel/helper-replace-supers/lib/index.js",
        "@babel/helper-function-name": "./node_modules/@babel/helper-function-name/lib/index.js",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/helper-define-map": "./node_modules/@babel/helper-define-map/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js",
        "globals": "./node_modules/globals/index.js"
      },
      "./node_modules/babel-plugin-transform-commonjs/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/bl/node_modules/readable-stream/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "string_decoder": "./node_modules/bl/node_modules/string_decoder/index.js",
        "core-util-is": "./node_modules/core-util-is/lib/util.js",
        "inherits": "./node_modules/inherits/inherits.js",
        "isarray": "./node_modules/bl/node_modules/isarray/index.js"
      },
      "./node_modules/table/node_modules/string-width/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "is-fullwidth-code-point": "./node_modules/is-fullwidth-code-point/index.js",
        "emoji-regex": "./node_modules/emoji-regex/index.js",
        "strip-ansi": "./node_modules/strip-ansi/index.js"
      },
      "./node_modules/@babel/helper-annotate-as-pure/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/types": "./node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/@babel/plugin-transform-for-of/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@babel/plugin-transform-spread/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/extract-zip/node_modules/debug/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "ms": "./node_modules/extract-zip/node_modules/ms/index.js"
      },
      "./node_modules/flat-cache/node_modules/rimraf/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "glob": "./node_modules/glob/glob.js"
      },
      "./node_modules/@babel/helper-hoist-variables/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/types": "./node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/@jsenv/eslint-import-resolver/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/import-map": "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/import-map/index.js",
        "@jsenv/logger": "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/logger/index.js",
        "@jsenv/href": "./node_modules/@jsenv/eslint-import-resolver/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/node-module-import-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
        "@jsenv/import-map": "./node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/import-map/index.js",
        "@dmail/helper": "./node_modules/@dmail/helper/index.js",
        "@jsenv/logger": "./node_modules/@jsenv/node-module-import-map/node_modules/@jsenv/logger/index.js",
        "/": "/"
      },
      "./node_modules/@jsenv/prettier-check-project/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/prettier-check-project/node_modules/@jsenv/operating-system-path/index.js",
        "@dmail/filesystem-matching": "./node_modules/@dmail/filesystem-matching/index.js",
        "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
        "@jsenv/url-meta": "./node_modules/@jsenv/prettier-check-project/node_modules/@jsenv/url-meta/index.js",
        "prettier": "./node_modules/prettier/index.js"
      },
      "./node_modules/puppeteer/node_modules/rimraf/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "glob": "./node_modules/glob/glob.js"
      },
      "./node_modules/regenerate-unicode-properties/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "regenerate": "./node_modules/regenerate/regenerate.js"
      },
      "./node_modules/@babel/helper-module-imports/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/types": "./node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/@babel/helper-replace-supers/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-member-expression-to-functions": "./node_modules/@babel/helper-member-expression-to-functions/lib/index.js",
        "@babel/helper-optimise-call-expression": "./node_modules/@babel/helper-optimise-call-expression/lib/index.js",
        "@babel/traverse": "./node_modules/@babel/traverse/lib/index.js",
        "@babel/types": "./node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/@jsenv/error-stack-sourcemap/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/href/": "./node_modules/@jsenv/href/",
        "@jsenv/href": "./node_modules/@jsenv/href/index.js",
        "source-map": "./node_modules/@jsenv/error-stack-sourcemap/node_modules/source-map/source-map.js"
      },
      "./node_modules/@jsenv/operating-system-path/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/href": "./node_modules/@jsenv/operating-system-path/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/eslint/node_modules/doctrine/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "esutils": "./node_modules/esutils/lib/utils.js"
      },
      "./node_modules/validate-npm-package-license/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "spdx-expression-parse": "./node_modules/spdx-expression-parse/index.js",
        "spdx-correct": "./node_modules/spdx-correct/index.js"
      },
      "./node_modules/@babel/helper-call-delegate/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-hoist-variables": "./node_modules/@babel/helper-hoist-variables/lib/index.js",
        "@babel/traverse": "./node_modules/@babel/traverse/lib/index.js",
        "@babel/types": "./node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/@babel/helper-function-name/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-get-function-arity": "./node_modules/@babel/helper-get-function-arity/lib/index.js",
        "@babel/template": "./node_modules/@babel/template/lib/index.js",
        "@babel/types": "./node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/eslint-import-resolver-node/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "resolve": "./node_modules/resolve/index.js",
        "debug": "./node_modules/eslint-import-resolver-node/node_modules/debug/src/index.js"
      },
      "./node_modules/level-js/node_modules/xtend/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "object-keys": "./node_modules/level-js/node_modules/object-keys/index.js"
      },
      "./node_modules/rollup-plugin-node-builtins/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "crypto-browserify": "./node_modules/crypto-browserify/index.js",
        "browserify-fs": "./node_modules/browserify-fs/index.js",
        "process-es6": "./node_modules/process-es6/browser.js",
        "buffer-es6": "./node_modules/buffer-es6/index.js"
      },
      "./node_modules/@dmail/filesystem-matching/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@dmail/filesystem-matching/node_modules/@jsenv/operating-system-path/index.js",
        "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
        "@jsenv/url-meta": "./node_modules/@dmail/filesystem-matching/node_modules/@jsenv/url-meta/index.js"
      },
      "./node_modules/rollup-plugin-node-globals/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "rollup-pluginutils": "./node_modules/rollup-pluginutils/dist/pluginutils.es.js",
        "estree-walker": "./node_modules/rollup-plugin-node-globals/node_modules/estree-walker/dist/estree-walker.es.js",
        "magic-string": "./node_modules/rollup-plugin-node-globals/node_modules/magic-string/dist/magic-string.es.js",
        "process-es6": "./node_modules/process-es6/browser.js",
        "buffer-es6": "./node_modules/buffer-es6/index.js",
        "acorn": "./node_modules/rollup-plugin-node-globals/node_modules/acorn/dist/acorn.es.js"
      },
      "./node_modules/rollup-plugin-node-resolve/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "rollup-pluginutils": "./node_modules/rollup-pluginutils/dist/pluginutils.es.js",
        "builtin-modules": "./node_modules/builtin-modules/index.js",
        "is-module": "./node_modules/is-module/index.js",
        "resolve": "./node_modules/resolve/index.js",
        "rollup": "./node_modules/rollup/dist/rollup.es.js"
      },
      "./node_modules/string.prototype.trimright/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "define-properties": "./node_modules/define-properties/index.js",
        "function-bind": "./node_modules/function-bind/index.js"
      },
      "./node_modules/@jsenv/commonjs-converter/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "babel-plugin-transform-commonjs": "./node_modules/@jsenv/commonjs-converter/node_modules/babel-plugin-transform-commonjs/dist/index.js",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/commonjs-converter/node_modules/@jsenv/operating-system-path/index.js",
        "rollup-plugin-node-builtins": "./node_modules/rollup-plugin-node-builtins/dist/rollup-plugin-node-builtins.es6.js",
        "rollup-plugin-node-globals": "./node_modules/rollup-plugin-node-globals/dist/rollup-plugin-node-globals.es6.js",
        "rollup-plugin-node-resolve": "./node_modules/rollup-plugin-node-resolve/dist/rollup-plugin-node-resolve.es.js",
        "rollup-plugin-commonjs": "./node_modules/rollup-plugin-commonjs/dist/rollup-plugin-commonjs.es.js",
        "rollup-plugin-replace": "./node_modules/rollup-plugin-replace/dist/rollup-plugin-replace.es.js",
        "rollup-plugin-json": "./node_modules/rollup-plugin-json/dist/rollup-plugin-json.es.js",
        "@jsenv/href": "./node_modules/@jsenv/commonjs-converter/node_modules/@jsenv/href/index.js",
        "rollup": "./node_modules/@jsenv/commonjs-converter/node_modules/rollup/dist/rollup.es.js",
        "/": "/"
      },
      "./node_modules/string.prototype.trimleft/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "define-properties": "./node_modules/define-properties/index.js",
        "function-bind": "./node_modules/function-bind/index.js"
      },
      "./node_modules/@babel/helper-define-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-function-name": "./node_modules/@babel/helper-function-name/lib/index.js",
        "@babel/types": "./node_modules/@babel/types/lib/index.js",
        "lodash": "./node_modules/lodash/lodash.js"
      },
      "./node_modules/@babel/plugin-syntax-jsx/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@jsenv/chromium-launcher/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/error-stack-sourcemap/": "./node_modules/@jsenv/error-stack-sourcemap/",
        "@jsenv/error-stack-sourcemap": "./node_modules/@jsenv/error-stack-sourcemap/index.js",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/babel-plugin-map": "./node_modules/@jsenv/babel-plugin-map/index.js",
        "@dmail/process-signals": "./node_modules/@dmail/process-signals/index.js",
        "@jsenv/compile-server/": "./node_modules/@jsenv/compile-server/",
        "@jsenv/compile-server": "./node_modules/@jsenv/compile-server/index.js",
        "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
        "@jsenv/import-map/": "./node_modules/@jsenv/chromium-launcher/node_modules/@jsenv/import-map/",
        "@jsenv/import-map": "./node_modules/@jsenv/chromium-launcher/node_modules/@jsenv/import-map/index.js",
        "@dmail/server": "./node_modules/@dmail/server/index.js",
        "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
        "@jsenv/href/": "./node_modules/@jsenv/href/",
        "@jsenv/href": "./node_modules/@jsenv/href/index.js",
        "source-map": "./node_modules/@jsenv/chromium-launcher/node_modules/source-map/source-map.js",
        "puppeteer": "./node_modules/puppeteer/index.js"
      },
      "./node_modules/@dmail/filesystem-watch/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@dmail/filesystem-watch/node_modules/@jsenv/operating-system-path/index.js",
        "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
        "@jsenv/url-meta": "./node_modules/@dmail/filesystem-watch/node_modules/@jsenv/url-meta/index.js"
      },
      "./node_modules/@jsenv/babel-plugin-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/plugin-transform-exponentiation-operator": "./node_modules/@babel/plugin-transform-exponentiation-operator/lib/index.js",
        "@babel/plugin-transform-block-scoped-functions": "./node_modules/@babel/plugin-transform-block-scoped-functions/lib/index.js",
        "@babel/plugin-proposal-optional-catch-binding": "./node_modules/@babel/plugin-proposal-optional-catch-binding/lib/index.js",
        "@babel/plugin-proposal-unicode-property-regex": "./node_modules/@babel/plugin-proposal-unicode-property-regex/lib/index.js",
        "@babel/plugin-transform-shorthand-properties": "./node_modules/@babel/plugin-transform-shorthand-properties/lib/index.js",
        "@babel/plugin-syntax-optional-catch-binding": "./node_modules/@babel/plugin-syntax-optional-catch-binding/lib/index.js",
        "@babel/plugin-transform-computed-properties": "./node_modules/@babel/plugin-transform-computed-properties/lib/index.js",
        "@babel/plugin-proposal-object-rest-spread": "./node_modules/@babel/plugin-proposal-object-rest-spread/lib/index.js",
        "@babel/plugin-transform-template-literals": "./node_modules/@babel/plugin-transform-template-literals/lib/index.js",
        "babel-plugin-transform-async-to-promises": "./node_modules/babel-plugin-transform-async-to-promises/async-to-promises.js",
        "@babel/plugin-syntax-object-rest-spread": "./node_modules/@babel/plugin-syntax-object-rest-spread/lib/index.js",
        "@babel/plugin-transform-arrow-functions": "./node_modules/@babel/plugin-transform-arrow-functions/lib/index.js",
        "@babel/plugin-transform-duplicate-keys": "./node_modules/@babel/plugin-transform-duplicate-keys/lib/index.js",
        "@babel/plugin-transform-block-scoping": "./node_modules/@babel/plugin-transform-block-scoping/lib/index.js",
        "@babel/plugin-transform-destructuring": "./node_modules/@babel/plugin-transform-destructuring/lib/index.js",
        "@babel/plugin-transform-function-name": "./node_modules/@babel/plugin-transform-function-name/lib/index.js",
        "@babel/plugin-transform-typeof-symbol": "./node_modules/@babel/plugin-transform-typeof-symbol/lib/index.js",
        "@babel/plugin-transform-unicode-regex": "./node_modules/@babel/plugin-transform-unicode-regex/lib/index.js",
        "@babel/plugin-transform-dotall-regex": "./node_modules/@babel/plugin-transform-dotall-regex/lib/index.js",
        "@babel/plugin-transform-object-super": "./node_modules/@babel/plugin-transform-object-super/lib/index.js",
        "@babel/plugin-transform-sticky-regex": "./node_modules/@babel/plugin-transform-sticky-regex/lib/index.js",
        "@babel/plugin-proposal-json-strings": "./node_modules/@babel/plugin-proposal-json-strings/lib/index.js",
        "@babel/plugin-transform-regenerator": "./node_modules/@babel/plugin-transform-regenerator/lib/index.js",
        "@babel/plugin-transform-new-target": "./node_modules/@babel/plugin-transform-new-target/lib/index.js",
        "@babel/plugin-transform-parameters": "./node_modules/@babel/plugin-transform-parameters/lib/index.js",
        "@babel/plugin-transform-literals": "./node_modules/@babel/plugin-transform-literals/lib/index.js",
        "@babel/plugin-transform-classes": "./node_modules/@babel/plugin-transform-classes/lib/index.js",
        "@babel/plugin-transform-for-of": "./node_modules/@babel/plugin-transform-for-of/lib/index.js",
        "@babel/plugin-transform-spread": "./node_modules/@babel/plugin-transform-spread/lib/index.js",
        "@babel/core": "./node_modules/@jsenv/babel-plugin-map/node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/istanbul-lib-instrument/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "istanbul-lib-coverage": "./node_modules/istanbul-lib-coverage/index.js",
        "@babel/generator": "./node_modules/@babel/generator/lib/index.js",
        "@babel/template": "./node_modules/@babel/template/lib/index.js",
        "@babel/traverse": "./node_modules/@babel/traverse/lib/index.js",
        "@babel/parser": "./node_modules/@babel/parser/lib/index.js",
        "@babel/types": "./node_modules/@babel/types/lib/index.js",
        "semver": "./node_modules/istanbul-lib-instrument/node_modules/semver/semver.js"
      },
      "./node_modules/@dmail/process-signals/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@dmail/helper": "./node_modules/@dmail/helper/index.js"
      },
      "./node_modules/normalize-package-data/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "validate-npm-package-license": "./node_modules/validate-npm-package-license/index.js",
        "hosted-git-info": "./node_modules/hosted-git-info/index.js",
        "resolve": "./node_modules/resolve/index.js",
        "semver": "./node_modules/semver/semver.js"
      },
      "./node_modules/rollup-plugin-commonjs/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "rollup-pluginutils": "./node_modules/rollup-pluginutils/dist/pluginutils.es.js",
        "estree-walker": "./node_modules/estree-walker/src/estree-walker.js",
        "is-reference": "./node_modules/is-reference/dist/is-reference.es.js",
        "magic-string": "./node_modules/magic-string/dist/magic-string.es.js",
        "resolve": "./node_modules/resolve/index.js",
        "rollup": "./node_modules/rollup/dist/rollup.es.js"
      },
      "./node_modules/@jsenv/codecov-upload/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "codecov": "./node_modules/codecov/index.js"
      },
      "./node_modules/@jsenv/compile-server/": {
        "@jsenv/core/": "./node_modules/@jsenv/core/",
        "@jsenv/node-module-import-map": "./node_modules/@jsenv/node-module-import-map/index.js",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@dmail/filesystem-watch": "./node_modules/@dmail/filesystem-watch/index.js",
        "@jsenv/babel-plugin-map": "./node_modules/@jsenv/babel-plugin-map/index.js",
        "@dmail/process-signals": "./node_modules/@dmail/process-signals/index.js",
        "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
        "@jsenv/import-map/": "./node_modules/@jsenv/compile-server/node_modules/@jsenv/import-map/",
        "@jsenv/import-map": "./node_modules/@jsenv/compile-server/node_modules/@jsenv/import-map/index.js",
        "abort-controller": "./node_modules/abort-controller/dist/abort-controller.js",
        "@jsenv/bundling": "./node_modules/@jsenv/compile-server/node_modules/@jsenv/bundling/index.js",
        "@jsenv/url-meta": "./node_modules/@jsenv/url-meta/index.js",
        "@dmail/helper": "./node_modules/@dmail/helper/index.js",
        "@dmail/server": "./node_modules/@dmail/server/index.js",
        "@dmail/uneval": "./node_modules/@dmail/uneval/index.js",
        "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
        "@jsenv/href/": "./node_modules/@jsenv/href/",
        "@jsenv/core": "./node_modules/@jsenv/core/index.js",
        "@jsenv/href": "./node_modules/@jsenv/href/index.js",
        "eventsource": "./node_modules/eventsource/lib/eventsource.js",
        "node-fetch": "./node_modules/node-fetch/lib/index.mjs",
        "systemjs": "./node_modules/systemjs/index.js",
        "/": "/"
      },
      "./node_modules/regenerator-transform/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "private": "./node_modules/private/private.js"
      },
      "./node_modules/rollup-plugin-replace/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "rollup-pluginutils": "./node_modules/rollup-pluginutils/dist/pluginutils.es.js",
        "magic-string": "./node_modules/magic-string/dist/magic-string.es.js"
      },
      "./node_modules/spdx-expression-parse/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "spdx-license-ids": "./node_modules/spdx-license-ids/index.json",
        "spdx-exceptions": "./node_modules/spdx-exceptions/index.json"
      },
      "./node_modules/@jsenv/eslint-config/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/plugin-syntax-dynamic-import": "./node_modules/@babel/plugin-syntax-dynamic-import/lib/index.js",
        "@babel/plugin-syntax-import-meta": "./node_modules/@babel/plugin-syntax-import-meta/lib/index.js",
        "@jsenv/eslint-import-resolver": "./node_modules/@jsenv/eslint-import-resolver/index.js",
        "@babel/plugin-syntax-jsx": "./node_modules/@babel/plugin-syntax-jsx/lib/index.js",
        "eslint-plugin-import": "./node_modules/eslint-plugin-import/lib/index.js",
        "eslint-plugin-react": "./node_modules/eslint-plugin-react/index.js",
        "babel-eslint": "./node_modules/babel-eslint/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js"
      },
      "./node_modules/@jsenv/node-launcher/": {
        "@jsenv/core/": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/",
        "@jsenv/node-module-import-map": "./node_modules/@jsenv/node-module-import-map/index.js",
        "@jsenv/error-stack-sourcemap": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/error-stack-sourcemap/index.js",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/babel-plugin-map": "./node_modules/@jsenv/babel-plugin-map/index.js",
        "@dmail/process-signals": "./node_modules/@dmail/process-signals/index.js",
        "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
        "@jsenv/import-map/": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/import-map/",
        "@jsenv/import-map": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/import-map/index.js",
        "abort-controller": "./node_modules/abort-controller/dist/abort-controller.js",
        "@jsenv/bundling": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/bundling/index.js",
        "@dmail/server": "./node_modules/@dmail/server/index.js",
        "@dmail/uneval": "./node_modules/@dmail/uneval/index.js",
        "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
        "@jsenv/href/": "./node_modules/@jsenv/href/",
        "@jsenv/core": "./node_modules/@jsenv/node-launcher/node_modules/@jsenv/core/index.js",
        "@jsenv/href": "./node_modules/@jsenv/href/index.js",
        "node-fetch": "./node_modules/node-fetch/lib/index.mjs",
        "source-map": "./node_modules/@jsenv/node-launcher/node_modules/source-map/source-map.js",
        "/": "/"
      },
      "./node_modules/eslint-plugin-import/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "eslint-import-resolver-node": "./node_modules/eslint-import-resolver-node/index.js",
        "eslint-module-utils": "./node_modules/eslint-module-utils/index.js",
        "array-includes": "./node_modules/array-includes/index.js",
        "contains-path": "./node_modules/contains-path/index.js",
        "object.values": "./node_modules/object.values/index.js",
        "read-pkg-up": "./node_modules/read-pkg-up/index.js",
        "minimatch": "./node_modules/minimatch/minimatch.js",
        "doctrine": "./node_modules/doctrine/lib/doctrine.js",
        "resolve": "./node_modules/resolve/index.js",
        "eslint": "./node_modules/eslint/lib/api.js",
        "debug": "./node_modules/eslint-plugin-import/node_modules/debug/src/index.js",
        "has": "./node_modules/has/src/index.js"
      },
      "./node_modules/@babel/helper-regex/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "lodash": "./node_modules/lodash/lodash.js"
      },
      "./node_modules/eslint-module-utils/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "pkg-dir": "./node_modules/pkg-dir/index.js",
        "debug": "./node_modules/eslint-module-utils/node_modules/debug/src/index.js"
      },
      "./node_modules/eslint-plugin-react/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "object.fromentries": "./node_modules/object.fromentries/index.js",
        "array-includes": "./node_modules/array-includes/index.js",
        "object.entries": "./node_modules/object.entries/index.js",
        "jsx-ast-utils": "./node_modules/jsx-ast-utils/lib/index.js",
        "object.values": "./node_modules/object.values/index.js",
        "prop-types": "./node_modules/prop-types/index.js",
        "doctrine": "./node_modules/eslint-plugin-react/node_modules/doctrine/lib/doctrine.js",
        "resolve": "./node_modules/resolve/index.js",
        "eslint": "./node_modules/eslint/lib/api.js",
        "has": "./node_modules/has/src/index.js"
      },
      "./node_modules/istanbul-lib-report/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "istanbul-lib-coverage": "./node_modules/istanbul-lib-coverage/index.js",
        "supports-color": "./node_modules/istanbul-lib-report/node_modules/supports-color/index.js",
        "make-dir": "./node_modules/make-dir/index.js"
      },
      "./node_modules/abstract-leveldown/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "xtend": "./node_modules/abstract-leveldown/node_modules/xtend/index.js"
      },
      "./node_modules/convert-source-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "safe-buffer": "./node_modules/safe-buffer/index.js"
      },
      "./node_modules/deferred-leveldown/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "abstract-leveldown": "./node_modules/abstract-leveldown/abstract-leveldown.js"
      },
      "./node_modules/object.fromentries/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "define-properties": "./node_modules/define-properties/index.js",
        "function-bind": "./node_modules/function-bind/index.js",
        "es-abstract": "./node_modules/es-abstract/index.js",
        "has": "./node_modules/has/src/index.js"
      },
      "./node_modules/rollup-plugin-json/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "rollup-pluginutils": "./node_modules/rollup-pluginutils/dist/pluginutils.es.js"
      },
      "./node_modules/rollup-pluginutils/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "estree-walker": "./node_modules/estree-walker/src/estree-walker.js"
      },
      "./node_modules/source-map-support/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "buffer-from": "./node_modules/buffer-from/index.js",
        "source-map": "./node_modules/source-map-support/node_modules/source-map/source-map.js"
      },
      "./node_modules/@babel/code-frame/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/highlight": "./node_modules/@babel/highlight/lib/index.js"
      },
      "./node_modules/@jsenv/import-map/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/href": "./node_modules/@jsenv/import-map/node_modules/@jsenv/href/index.js",
        "/": "/"
      },
      "./node_modules/browserify-cipher/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "browserify-aes": "./node_modules/browserify-aes/index.js",
        "browserify-des": "./node_modules/browserify-des/index.js",
        "evp_bytestokey": "./node_modules/evp_bytestokey/index.js"
      },
      "./node_modules/crypto-browserify/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "browserify-cipher": "./node_modules/browserify-cipher/index.js",
        "browserify-sign": "./node_modules/browserify-sign/index.js",
        "diffie-hellman": "./node_modules/diffie-hellman/index.js",
        "public-encrypt": "./node_modules/public-encrypt/index.js",
        "create-ecdh": "./node_modules/create-ecdh/index.js",
        "create-hash": "./node_modules/create-hash/index.js",
        "create-hmac": "./node_modules/create-hmac/index.js",
        "randombytes": "./node_modules/randombytes/index.js",
        "randomfill": "./node_modules/randomfill/index.js",
        "inherits": "./node_modules/inherits/inherits.js",
        "pbkdf2": "./node_modules/pbkdf2/index.js"
      },
      "./node_modules/define-properties/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "object-keys": "./node_modules/object-keys/index.js"
      },
      "./node_modules/https-proxy-agent/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "agent-base": "./node_modules/agent-base/index.js",
        "debug": "./node_modules/https-proxy-agent/node_modules/debug/src/index.js"
      },
      "./node_modules/@babel/generator/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/types": "./node_modules/@babel/generator/node_modules/@babel/types/lib/index.js",
        "source-map": "./node_modules/source-map/source-map.js",
        "lodash": "./node_modules/lodash/lodash.js",
        "jsesc": "./node_modules/jsesc/jsesc.js"
      },
      "./node_modules/@babel/highlight/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "js-tokens": "./node_modules/js-tokens/index.js",
        "esutils": "./node_modules/esutils/lib/utils.js",
        "chalk": "./node_modules/chalk/index.js"
      },
      "./node_modules/@jsenv/execution/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/compile-server/": "./node_modules/@jsenv/compile-server/",
        "@jsenv/compile-server": "./node_modules/@jsenv/compile-server/index.js",
        "istanbul-lib-coverage": "./node_modules/@jsenv/execution/node_modules/istanbul-lib-coverage/index.js",
        "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
        "@dmail/helper": "./node_modules/@dmail/helper/index.js",
        "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
        "@jsenv/href/": "./node_modules/@jsenv/href/",
        "@jsenv/href": "./node_modules/@jsenv/href/index.js",
        "eventsource": "./node_modules/eventsource/lib/eventsource.js"
      },
      "./node_modules/abort-controller/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "event-target-shim": "./node_modules/event-target-shim/dist/event-target-shim.js"
      },
      "./node_modules/file-entry-cache/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "flat-cache": "./node_modules/flat-cache/cache.js"
      },
      "./node_modules/istanbul-reports/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "handlebars": "./node_modules/handlebars/lib/index.js"
      },
      "./node_modules/level-filesystem/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "level-sublevel": "./node_modules/level-sublevel/index.js",
        "concat-stream": "./node_modules/concat-stream/index.js",
        "level-blobs": "./node_modules/level-blobs/index.js",
        "fwd-stream": "./node_modules/fwd-stream/index.js",
        "level-peek": "./node_modules/level-peek/index.js",
        "errno": "./node_modules/errno/errno.js",
        "octal": "./node_modules/octal/index.js",
        "xtend": "./node_modules/xtend/index.js",
        "once": "./node_modules/once/once.js"
      },
      "./node_modules/@babel/template/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
        "@babel/parser": "./node_modules/@babel/parser/lib/index.js",
        "@babel/types": "./node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/@babel/traverse/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/helper-split-export-declaration": "./node_modules/@babel/helper-split-export-declaration/lib/index.js",
        "@babel/helper-function-name": "./node_modules/@babel/helper-function-name/lib/index.js",
        "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
        "@babel/generator": "./node_modules/@babel/generator/lib/index.js",
        "@babel/parser": "./node_modules/@babel/traverse/node_modules/@babel/parser/lib/index.js",
        "@babel/types": "./node_modules/@babel/traverse/node_modules/@babel/types/lib/index.js",
        "globals": "./node_modules/globals/index.js",
        "lodash": "./node_modules/lodash/lodash.js",
        "debug": "./node_modules/debug/src/index.js"
      },
      "./node_modules/@jsenv/bundling/": {
        "@jsenv/core/": "./node_modules/@jsenv/core/",
        "@jsenv/node-module-import-map": "./node_modules/@jsenv/bundling/node_modules/@jsenv/node-module-import-map/index.js",
        "@babel/helper-module-imports": "./node_modules/@babel/helper-module-imports/lib/index.js",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@jsenv/babel-plugin-map": "./node_modules/@jsenv/babel-plugin-map/index.js",
        "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
        "@jsenv/import-map/": "./node_modules/@jsenv/bundling/node_modules/@jsenv/import-map/",
        "@jsenv/import-map": "./node_modules/@jsenv/bundling/node_modules/@jsenv/import-map/index.js",
        "abort-controller": "./node_modules/abort-controller/dist/abort-controller.js",
        "@dmail/helper": "./node_modules/@dmail/helper/index.js",
        "@dmail/server": "./node_modules/@dmail/server/index.js",
        "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
        "@jsenv/href/": "./node_modules/@jsenv/href/",
        "@jsenv/core": "./node_modules/@jsenv/core/index.js",
        "@jsenv/href": "./node_modules/@jsenv/href/index.js",
        "node-fetch": "./node_modules/node-fetch/lib/index.mjs",
        "rollup": "./node_modules/rollup/dist/rollup.es.js",
        "terser": "./node_modules/terser/dist/bundle.min.js",
        "/": "/"
      },
      "./node_modules/@jsenv/url-meta/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/import-map": "./node_modules/@jsenv/url-meta/node_modules/@jsenv/import-map/index.js",
        "/": "/"
      },
      "./node_modules/brace-expansion/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "balanced-match": "./node_modules/balanced-match/index.js",
        "concat-map": "./node_modules/concat-map/index.js"
      },
      "./node_modules/browserify-sign/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "browserify-rsa": "./node_modules/browserify-rsa/index.js",
        "create-hash": "./node_modules/create-hash/index.js",
        "create-hmac": "./node_modules/create-hmac/index.js",
        "parse-asn1": "./node_modules/parse-asn1/index.js",
        "elliptic": "./node_modules/elliptic/lib/elliptic.js",
        "inherits": "./node_modules/inherits/inherits.js",
        "bn.js": "./node_modules/bn.js/lib/bn.js"
      },
      "./node_modules/es-to-primitive/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "is-date-object": "./node_modules/is-date-object/index.js",
        "is-callable": "./node_modules/is-callable/index.js",
        "is-symbol": "./node_modules/is-symbol/index.js"
      },
      "./node_modules/external-editor/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "iconv-lite": "./node_modules/iconv-lite/lib/index.js",
        "chardet": "./node_modules/chardet/index.js",
        "tmp": "./node_modules/tmp/lib/tmp.js"
      },
      "./node_modules/proper-lockfile/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "graceful-fs": "./node_modules/graceful-fs/graceful-fs.js",
        "signal-exit": "./node_modules/signal-exit/index.js",
        "retry": "./node_modules/retry/index.js"
      },
      "./node_modules/readable-stream/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "process-nextick-args": "./node_modules/process-nextick-args/index.js",
        "string_decoder": "./node_modules/string_decoder/lib/string_decoder.js",
        "util-deprecate": "./node_modules/util-deprecate/node.js",
        "core-util-is": "./node_modules/core-util-is/lib/util.js",
        "safe-buffer": "./node_modules/safe-buffer/index.js",
        "inherits": "./node_modules/inherits/inherits.js",
        "isarray": "./node_modules/isarray/index.js"
      },
      "./node_modules/shebang-command/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "shebang-regex": "./node_modules/shebang-regex/index.js"
      },
      "./node_modules/@babel/helpers/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/template": "./node_modules/@babel/helpers/node_modules/@babel/template/lib/index.js",
        "@babel/traverse": "./node_modules/@babel/helpers/node_modules/@babel/traverse/lib/index.js",
        "@babel/types": "./node_modules/@babel/helpers/node_modules/@babel/types/lib/index.js"
      },
      "./node_modules/@jsenv/testing/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/plugin-syntax-dynamic-import": "./node_modules/@babel/plugin-syntax-dynamic-import/lib/index.js",
        "@babel/plugin-syntax-import-meta": "./node_modules/@babel/plugin-syntax-import-meta/lib/index.js",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@dmail/filesystem-matching": "./node_modules/@dmail/filesystem-matching/index.js",
        "@dmail/filesystem-watch": "./node_modules/@dmail/filesystem-watch/index.js",
        "istanbul-lib-instrument": "./node_modules/istanbul-lib-instrument/dist/index.js",
        "@jsenv/compile-server/": "./node_modules/@jsenv/compile-server/",
        "@jsenv/compile-server": "./node_modules/@jsenv/compile-server/index.js",
        "istanbul-lib-coverage": "./node_modules/istanbul-lib-coverage/index.js",
        "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
        "istanbul-lib-report": "./node_modules/istanbul-lib-report/index.js",
        "@jsenv/execution": "./node_modules/@jsenv/execution/index.js",
        "istanbul-reports": "./node_modules/istanbul-reports/index.js",
        "@jsenv/url-meta": "./node_modules/@jsenv/url-meta/index.js",
        "@dmail/helper": "./node_modules/@dmail/helper/index.js",
        "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
        "node-notifier": "./node_modules/node-notifier/index.js",
        "@jsenv/href/": "./node_modules/@jsenv/href/",
        "@babel/core": "./node_modules/@babel/core/lib/index.js",
        "@jsenv/href": "./node_modules/@jsenv/href/index.js",
        "node-fetch": "./node_modules/node-fetch/lib/index.mjs",
        "cuid": "./node_modules/cuid/index.js"
      },
      "./node_modules/array-includes/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "define-properties": "./node_modules/define-properties/index.js",
        "es-abstract": "./node_modules/es-abstract/index.js"
      },
      "./node_modules/browserify-aes/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "evp_bytestokey": "./node_modules/evp_bytestokey/index.js",
        "cipher-base": "./node_modules/cipher-base/index.js",
        "create-hash": "./node_modules/create-hash/index.js",
        "safe-buffer": "./node_modules/safe-buffer/index.js",
        "buffer-xor": "./node_modules/buffer-xor/index.js",
        "inherits": "./node_modules/inherits/inherits.js"
      },
      "./node_modules/browserify-des/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "cipher-base": "./node_modules/cipher-base/index.js",
        "safe-buffer": "./node_modules/safe-buffer/index.js",
        "inherits": "./node_modules/inherits/inherits.js",
        "des.js": "./node_modules/des.js/lib/des.js"
      },
      "./node_modules/browserify-rsa/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "randombytes": "./node_modules/randombytes/index.js",
        "bn.js": "./node_modules/bn.js/lib/bn.js"
      },
      "./node_modules/diffie-hellman/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "miller-rabin": "./node_modules/miller-rabin/lib/mr.js",
        "randombytes": "./node_modules/randombytes/index.js",
        "bn.js": "./node_modules/bn.js/lib/bn.js"
      },
      "./node_modules/evp_bytestokey/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "safe-buffer": "./node_modules/safe-buffer/index.js",
        "md5.js": "./node_modules/md5.js/index.js"
      },
      "./node_modules/level-sublevel/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "level-fix-range": "./node_modules/level-sublevel/node_modules/level-fix-range/index.js",
        "string-range": "./node_modules/string-range/index.js",
        "level-hooks": "./node_modules/level-hooks/index.js",
        "xtend": "./node_modules/level-sublevel/node_modules/xtend/index.js"
      },
      "./node_modules/load-json-file/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "graceful-fs": "./node_modules/graceful-fs/graceful-fs.js",
        "parse-json": "./node_modules/parse-json/index.js",
        "strip-bom": "./node_modules/strip-bom/index.js",
        "pify": "./node_modules/pify/index.js"
      },
      "./node_modules/object.entries/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "define-properties": "./node_modules/define-properties/index.js",
        "function-bind": "./node_modules/function-bind/index.js",
        "es-abstract": "./node_modules/es-abstract/index.js",
        "has": "./node_modules/has/src/index.js"
      },
      "./node_modules/public-encrypt/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "browserify-rsa": "./node_modules/browserify-rsa/index.js",
        "create-hash": "./node_modules/create-hash/index.js",
        "randombytes": "./node_modules/randombytes/index.js",
        "safe-buffer": "./node_modules/safe-buffer/index.js",
        "parse-asn1": "./node_modules/parse-asn1/index.js",
        "bn.js": "./node_modules/bn.js/lib/bn.js"
      },
      "./node_modules/restore-cursor/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "signal-exit": "./node_modules/signal-exit/index.js",
        "onetime": "./node_modules/onetime/index.js"
      },
      "./node_modules/string_decoder/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "safe-buffer": "./node_modules/safe-buffer/index.js"
      },
      "./node_modules/supports-color/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "has-flag": "./node_modules/has-flag/index.js"
      },
      "./node_modules/@dmail/assert/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@dmail/inspect": "./node_modules/@dmail/inspect/index.js"
      },
      "./node_modules/@dmail/server/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@jsenv/operating-system-path": "./node_modules/@dmail/server/node_modules/@jsenv/operating-system-path/index.js",
        "@dmail/process-signals": "./node_modules/@dmail/process-signals/index.js",
        "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
        "@dmail/helper": "./node_modules/@dmail/helper/index.js",
        "@jsenv/logger": "./node_modules/@dmail/server/node_modules/@jsenv/logger/index.js",
        "@jsenv/href": "./node_modules/@dmail/server/node_modules/@jsenv/href/index.js",
        "kill-port": "./node_modules/kill-port/index.js",
        "/": "/"
      },
      "./node_modules/browserify-fs/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "level-filesystem": "./node_modules/level-filesystem/index.js",
        "level-js": "./node_modules/level-js/index.js",
        "levelup": "./node_modules/levelup/lib/levelup.js"
      },
      "./node_modules/color-convert/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "color-name": "./node_modules/color-name/index.js"
      },
      "./node_modules/concat-stream/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "readable-stream": "./node_modules/readable-stream/readable.js",
        "buffer-from": "./node_modules/buffer-from/index.js",
        "typedarray": "./node_modules/typedarray/index.js",
        "inherits": "./node_modules/inherits/inherits.js"
      },
      "./node_modules/es6-promisify/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "es6-promise": "./node_modules/es6-promise/dist/es6-promise.js"
      },
      "./node_modules/jsx-ast-utils/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "array-includes": "./node_modules/array-includes/index.js",
        "object.assign": "./node_modules/object.assign/index.js"
      },
      "./node_modules/node-notifier/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "shellwords": "./node_modules/shellwords/lib/shellwords.js",
        "growly": "./node_modules/growly/lib/growly.js",
        "is-wsl": "./node_modules/is-wsl/index.js",
        "semver": "./node_modules/semver/semver.js",
        "which": "./node_modules/which/which.js"
      },
      "./node_modules/object.assign/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "define-properties": "./node_modules/define-properties/index.js",
        "function-bind": "./node_modules/function-bind/index.js",
        "has-symbols": "./node_modules/has-symbols/index.js",
        "object-keys": "./node_modules/object-keys/index.js"
      },
      "./node_modules/object.values/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "define-properties": "./node_modules/define-properties/index.js",
        "function-bind": "./node_modules/function-bind/index.js",
        "es-abstract": "./node_modules/es-abstract/index.js",
        "has": "./node_modules/has/src/index.js"
      },
      "./node_modules/parent-module/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "callsites": "./node_modules/callsites/index.js"
      },
      "./node_modules/teeny-request/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "https-proxy-agent": "./node_modules/https-proxy-agent/index.js",
        "node-fetch": "./node_modules/node-fetch/lib/index.mjs",
        "uuid": "./node_modules/uuid/index.js"
      },
      "./node_modules/@babel/types/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "to-fast-properties": "./node_modules/to-fast-properties/index.js",
        "esutils": "./node_modules/esutils/lib/utils.js",
        "lodash": "./node_modules/lodash/lodash.js"
      },
      "./node_modules/ansi-to-html/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "entities": "./node_modules/entities/index.js"
      },
      "./node_modules/babel-eslint/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "eslint-visitor-keys": "./node_modules/eslint-visitor-keys/lib/index.js",
        "eslint-scope": "./node_modules/eslint-scope/lib/index.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js",
        "eslint": "./node_modules/eslint/lib/api.js",
        "semver": "./node_modules/semver/semver.js"
      },
      "./node_modules/eslint-scope/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "estraverse": "./node_modules/estraverse/estraverse.js",
        "esrecurse": "./node_modules/esrecurse/esrecurse.js"
      },
      "./node_modules/eslint-utils/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "eslint-visitor-keys": "./node_modules/eslint-visitor-keys/lib/index.js"
      },
      "./node_modules/import-fresh/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "parent-module": "./node_modules/parent-module/index.js",
        "resolve-from": "./node_modules/resolve-from/index.js"
      },
      "./node_modules/loose-envify/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "js-tokens": "./node_modules/js-tokens/index.js"
      },
      "./node_modules/magic-string/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "sourcemap-codec": "./node_modules/sourcemap-codec/dist/sourcemap-codec.es.js"
      },
      "./node_modules/miller-rabin/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "brorand": "./node_modules/brorand/index.js",
        "bn.js": "./node_modules/bn.js/lib/bn.js"
      },
      "./node_modules/regexpu-core/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "unicode-match-property-value-ecmascript": "./node_modules/unicode-match-property-value-ecmascript/index.js",
        "unicode-match-property-ecmascript": "./node_modules/unicode-match-property-ecmascript/index.js",
        "regenerate-unicode-properties": "./node_modules/regenerate-unicode-properties/index.js",
        "regjsparser": "./node_modules/regjsparser/parser.js",
        "regenerate": "./node_modules/regenerate/regenerate.js",
        "regjsgen": "./node_modules/regjsgen/regjsgen.js"
      },
      "./node_modules/spdx-correct/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "spdx-expression-parse": "./node_modules/spdx-expression-parse/index.js",
        "spdx-license-ids": "./node_modules/spdx-license-ids/index.json"
      },
      "./node_modules/string-width/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "is-fullwidth-code-point": "./node_modules/is-fullwidth-code-point/index.js",
        "strip-ansi": "./node_modules/string-width/node_modules/strip-ansi/index.js"
      },
      "./node_modules/@babel/core/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "convert-source-map": "./node_modules/convert-source-map/index.js",
        "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
        "@babel/generator": "./node_modules/@babel/core/node_modules/@babel/generator/lib/index.js",
        "@babel/template": "./node_modules/@babel/core/node_modules/@babel/template/lib/index.js",
        "@babel/traverse": "./node_modules/@babel/core/node_modules/@babel/traverse/lib/index.js",
        "@babel/helpers": "./node_modules/@babel/helpers/lib/index.js",
        "@babel/parser": "./node_modules/@babel/core/node_modules/@babel/parser/lib/index.js",
        "@babel/types": "./node_modules/@babel/core/node_modules/@babel/types/lib/index.js",
        "source-map": "./node_modules/source-map/source-map.js",
        "resolve": "./node_modules/resolve/index.js",
        "lodash": "./node_modules/lodash/lodash.js",
        "semver": "./node_modules/semver/semver.js",
        "debug": "./node_modules/debug/src/index.js",
        "json5": "./node_modules/json5/lib/index.js"
      },
      "./node_modules/@jsenv/core/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "@babel/plugin-transform-modules-systemjs": "./node_modules/@babel/plugin-transform-modules-systemjs/lib/index.js",
        "@babel/plugin-syntax-dynamic-import": "./node_modules/@babel/plugin-syntax-dynamic-import/lib/index.js",
        "@babel/plugin-syntax-import-meta": "./node_modules/@babel/plugin-syntax-import-meta/lib/index.js",
        "babel-plugin-transform-commonjs": "./node_modules/babel-plugin-transform-commonjs/dist/index.js",
        "@babel/helper-hoist-variables": "./node_modules/@babel/helper-hoist-variables/lib/index.js",
        "@jsenv/operating-system-path": "./node_modules/@jsenv/operating-system-path/index.js",
        "@babel/helper-plugin-utils": "./node_modules/@babel/helper-plugin-utils/lib/index.js",
        "@jsenv/babel-plugin-map": "./node_modules/@jsenv/babel-plugin-map/index.js",
        "@dmail/cancellation": "./node_modules/@dmail/cancellation/index.js",
        "regenerator-runtime": "./node_modules/regenerator-runtime/runtime.js",
        "@jsenv/import-map/": "./node_modules/@jsenv/core/node_modules/@jsenv/import-map/",
        "@jsenv/import-map": "./node_modules/@jsenv/core/node_modules/@jsenv/import-map/index.js",
        "@jsenv/url-meta": "./node_modules/@jsenv/url-meta/index.js",
        "proper-lockfile": "./node_modules/proper-lockfile/index.js",
        "@babel/helpers": "./node_modules/@jsenv/core/node_modules/@babel/helpers/lib/index.js",
        "@dmail/helper": "./node_modules/@dmail/helper/index.js",
        "@jsenv/logger": "./node_modules/@jsenv/logger/index.js",
        "@jsenv/href/": "./node_modules/@jsenv/href/",
        "ansi-to-html": "./node_modules/ansi-to-html/lib/ansi_to_html.js",
        "@babel/core": "./node_modules/@babel/core/lib/index.js",
        "@jsenv/href": "./node_modules/@jsenv/href/index.js",
        "rimraf": "./node_modules/rimraf/rimraf.js"
      },
      "./node_modules/ansi-styles/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "color-convert": "./node_modules/color-convert/index.js"
      },
      "./node_modules/cipher-base/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "safe-buffer": "./node_modules/safe-buffer/index.js",
        "inherits": "./node_modules/inherits/inherits.js"
      },
      "./node_modules/create-ecdh/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "elliptic": "./node_modules/elliptic/lib/elliptic.js",
        "bn.js": "./node_modules/bn.js/lib/bn.js"
      },
      "./node_modules/create-hash/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "cipher-base": "./node_modules/cipher-base/index.js",
        "ripemd160": "./node_modules/ripemd160/index.js",
        "inherits": "./node_modules/inherits/inherits.js",
        "md5.js": "./node_modules/md5.js/index.js",
        "sha.js": "./node_modules/sha.js/index.js"
      },
      "./node_modules/create-hmac/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "cipher-base": "./node_modules/cipher-base/index.js",
        "create-hash": "./node_modules/create-hash/index.js",
        "safe-buffer": "./node_modules/safe-buffer/index.js",
        "ripemd160": "./node_modules/ripemd160/index.js",
        "inherits": "./node_modules/inherits/inherits.js",
        "sha.js": "./node_modules/sha.js/index.js"
      },
      "./node_modules/cross-spawn/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "shebang-command": "./node_modules/shebang-command/index.js",
        "nice-try": "./node_modules/nice-try/src/index.js",
        "path-key": "./node_modules/path-key/index.js",
        "semver": "./node_modules/semver/semver.js",
        "which": "./node_modules/which/which.js"
      },
      "./node_modules/es-abstract/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "string.prototype.trimright": "./node_modules/string.prototype.trimright/index.js",
        "string.prototype.trimleft": "./node_modules/string.prototype.trimleft/index.js",
        "es-to-primitive": "./node_modules/es-to-primitive/index.js",
        "object-inspect": "./node_modules/object-inspect/index.js",
        "function-bind": "./node_modules/function-bind/index.js",
        "has-symbols": "./node_modules/has-symbols/index.js",
        "is-callable": "./node_modules/is-callable/index.js",
        "object-keys": "./node_modules/object-keys/index.js",
        "is-regex": "./node_modules/is-regex/index.js",
        "has": "./node_modules/has/src/index.js"
      },
      "./node_modules/eventsource/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "original": "./node_modules/original/index.js"
      },
      "./node_modules/extract-zip/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "concat-stream": "./node_modules/concat-stream/index.js",
        "mkdirp": "./node_modules/mkdirp/index.js",
        "debug": "./node_modules/extract-zip/node_modules/debug/src/index.js",
        "yauzl": "./node_modules/yauzl/index.js"
      },
      "./node_modules/glob-parent/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "is-glob": "./node_modules/is-glob/index.js"
      },
      "./node_modules/ignore-walk/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "minimatch": "./node_modules/minimatch/minimatch.js"
      },
      "./node_modules/level-blobs/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "readable-stream": "./node_modules/level-blobs/node_modules/readable-stream/readable.js",
        "level-peek": "./node_modules/level-peek/index.js",
        "once": "./node_modules/once/once.js"
      },
      "./node_modules/level-hooks/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "string-range": "./node_modules/string-range/index.js"
      },
      "./node_modules/locate-path/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "path-exists": "./node_modules/path-exists/index.js",
        "p-locate": "./node_modules/p-locate/index.js"
      },
      "./node_modules/randombytes/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "safe-buffer": "./node_modules/safe-buffer/index.js"
      },
      "./node_modules/read-pkg-up/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "read-pkg": "./node_modules/read-pkg/index.js",
        "find-up": "./node_modules/find-up/index.js"
      },
      "./node_modules/regjsparser/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "jsesc": "./node_modules/regjsparser/node_modules/jsesc/jsesc.js"
      },
      "./node_modules/agent-base/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "es6-promisify": "./node_modules/es6-promisify/dist/promisify.js"
      },
      "./node_modules/cli-cursor/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "restore-cursor": "./node_modules/restore-cursor/index.js"
      },
      "./node_modules/flat-cache/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "flatted": "./node_modules/flatted/esm/index.js",
        "rimraf": "./node_modules/flat-cache/node_modules/rimraf/rimraf.js",
        "write": "./node_modules/write/index.js"
      },
      "./node_modules/fwd-stream/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "readable-stream": "./node_modules/fwd-stream/node_modules/readable-stream/readable.js"
      },
      "./node_modules/handlebars/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "source-map": "./node_modules/handlebars/node_modules/source-map/source-map.js",
        "neo-async": "./node_modules/neo-async/async.js",
        "uglify-js": "./node_modules/uglify-js/tools/node.js",
        "optimist": "./node_modules/optimist/index.js"
      },
      "./node_modules/iconv-lite/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "safer-buffer": "./node_modules/safer-buffer/safer.js"
      },
      "./node_modules/level-peek/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "level-fix-range": "./node_modules/level-fix-range/index.js"
      },
      "./node_modules/optionator/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "fast-levenshtein": "./node_modules/fast-levenshtein/levenshtein.js",
        "prelude-ls": "./node_modules/prelude-ls/lib/index.js",
        "type-check": "./node_modules/type-check/lib/index.js",
        "wordwrap": "./node_modules/wordwrap/index.js",
        "deep-is": "./node_modules/deep-is/index.js",
        "levn": "./node_modules/levn/lib/index.js"
      },
      "./node_modules/parse-asn1/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "browserify-aes": "./node_modules/browserify-aes/index.js",
        "evp_bytestokey": "./node_modules/evp_bytestokey/index.js",
        "create-hash": "./node_modules/create-hash/index.js",
        "safe-buffer": "./node_modules/safe-buffer/index.js",
        "asn1.js": "./node_modules/asn1.js/lib/asn1.js",
        "pbkdf2": "./node_modules/pbkdf2/index.js"
      },
      "./node_modules/parse-json/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "error-ex": "./node_modules/error-ex/index.js"
      },
      "./node_modules/prop-types/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "object-assign": "./node_modules/object-assign/index.js",
        "loose-envify": "./node_modules/loose-envify/index.js",
        "react-is": "./node_modules/react-is/index.js"
      },
      "./node_modules/randomfill/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "randombytes": "./node_modules/randombytes/index.js",
        "safe-buffer": "./node_modules/safe-buffer/index.js"
      },
      "./node_modules/slice-ansi/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "is-fullwidth-code-point": "./node_modules/is-fullwidth-code-point/index.js",
        "astral-regex": "./node_modules/astral-regex/index.js",
        "ansi-styles": "./node_modules/ansi-styles/index.js"
      },
      "./node_modules/strip-ansi/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "ansi-regex": "./node_modules/strip-ansi/node_modules/ansi-regex/index.js"
      },
      "./node_modules/type-check/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "prelude-ls": "./node_modules/prelude-ls/lib/index.js"
      },
      "./node_modules/acorn-jsx/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "acorn": "./node_modules/acorn/dist/acorn.mjs"
      },
      "./node_modules/esrecurse/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "estraverse": "./node_modules/estraverse/estraverse.js"
      },
      "./node_modules/fd-slicer/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "pend": "./node_modules/pend/index.js"
      },
      "./node_modules/hash-base/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "safe-buffer": "./node_modules/safe-buffer/index.js",
        "inherits": "./node_modules/inherits/inherits.js"
      },
      "./node_modules/hmac-drbg/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "minimalistic-crypto-utils": "./node_modules/minimalistic-crypto-utils/lib/utils.js",
        "minimalistic-assert": "./node_modules/minimalistic-assert/index.js",
        "hash.js": "./node_modules/hash.js/lib/hash.js"
      },
      "./node_modules/is-symbol/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "has-symbols": "./node_modules/has-symbols/index.js"
      },
      "./node_modules/kill-port/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "get-them-args": "./node_modules/get-them-args/index.js",
        "shell-exec": "./node_modules/shell-exec/index.js"
      },
      "./node_modules/minimatch/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "brace-expansion": "./node_modules/brace-expansion/index.js"
      },
      "./node_modules/path-type/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "pify": "./node_modules/pify/index.js"
      },
      "./node_modules/puppeteer/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "https-proxy-agent": "./node_modules/https-proxy-agent/index.js",
        "proxy-from-env": "./node_modules/proxy-from-env/index.js",
        "extract-zip": "./node_modules/extract-zip/index.js",
        "progress": "./node_modules/progress/index.js",
        "rimraf": "./node_modules/puppeteer/node_modules/rimraf/rimraf.js",
        "debug": "./node_modules/debug/src/index.js",
        "mime": "./node_modules/mime/index.js",
        "ws": "./node_modules/ws/index.js"
      },
      "./node_modules/ripemd160/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "hash-base": "./node_modules/hash-base/index.js",
        "inherits": "./node_modules/inherits/inherits.js"
      },
      "./node_modules/run-async/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "is-promise": "./node_modules/is-promise/index.js"
      },
      "./node_modules/uglify-js/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "source-map": "./node_modules/uglify-js/node_modules/source-map/source-map.js",
        "commander": "./node_modules/commander/index.js"
      },
      "./node_modules/url-parse/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "querystringify": "./node_modules/querystringify/index.js",
        "requires-port": "./node_modules/requires-port/index.js"
      },
      "./node_modules/argparse/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "sprintf-js": "./node_modules/sprintf-js/src/sprintf.js"
      },
      "./node_modules/doctrine/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "esutils": "./node_modules/esutils/lib/utils.js",
        "isarray": "./node_modules/isarray/index.js"
      },
      "./node_modules/elliptic/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "minimalistic-crypto-utils": "./node_modules/minimalistic-crypto-utils/lib/utils.js",
        "minimalistic-assert": "./node_modules/minimalistic-assert/index.js",
        "hmac-drbg": "./node_modules/hmac-drbg/lib/hmac-drbg.js",
        "inherits": "./node_modules/inherits/inherits.js",
        "brorand": "./node_modules/brorand/index.js",
        "hash.js": "./node_modules/hash.js/lib/hash.js",
        "bn.js": "./node_modules/bn.js/lib/bn.js"
      },
      "./node_modules/error-ex/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "is-arrayish": "./node_modules/is-arrayish/index.js"
      },
      "./node_modules/inflight/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "wrappy": "./node_modules/wrappy/wrappy.js",
        "once": "./node_modules/once/once.js"
      },
      "./node_modules/inquirer/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "external-editor": "./node_modules/external-editor/main/index.js",
        "ansi-escapes": "./node_modules/ansi-escapes/index.js",
        "string-width": "./node_modules/string-width/index.js",
        "mute-stream": "./node_modules/mute-stream/mute.js",
        "cli-cursor": "./node_modules/cli-cursor/index.js",
        "strip-ansi": "./node_modules/strip-ansi/index.js",
        "cli-width": "./node_modules/cli-width/index.js",
        "run-async": "./node_modules/run-async/index.js",
        "figures": "./node_modules/figures/index.js",
        "through": "./node_modules/through/index.js",
        "lodash": "./node_modules/lodash/lodash.js",
        "chalk": "./node_modules/chalk/index.js",
        "rxjs": "./node_modules/rxjs/_esm5/index.js"
      },
      "./node_modules/is-regex/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "has": "./node_modules/has/src/index.js"
      },
      "./node_modules/level-js/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "typedarray-to-buffer": "./node_modules/typedarray-to-buffer/index.js",
        "abstract-leveldown": "./node_modules/abstract-leveldown/abstract-leveldown.js",
        "idb-wrapper": "./node_modules/idb-wrapper/idbstore.js",
        "isbuffer": "./node_modules/isbuffer/index.js",
        "xtend": "./node_modules/level-js/node_modules/xtend/index.js",
        "ltgt": "./node_modules/ltgt/index.js"
      },
      "./node_modules/make-dir/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "semver": "./node_modules/make-dir/node_modules/semver/semver.js"
      },
      "./node_modules/optimist/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "minimist": "./node_modules/minimist/index.js",
        "wordwrap": "./node_modules/optimist/node_modules/wordwrap/index.js"
      },
      "./node_modules/original/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "url-parse": "./node_modules/url-parse/index.js"
      },
      "./node_modules/p-locate/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "p-limit": "./node_modules/p-limit/index.js"
      },
      "./node_modules/read-pkg/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "normalize-package-data": "./node_modules/normalize-package-data/lib/normalize.js",
        "load-json-file": "./node_modules/load-json-file/index.js",
        "path-type": "./node_modules/path-type/index.js"
      },
      "./node_modules/asn1.js/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "minimalistic-assert": "./node_modules/minimalistic-assert/index.js",
        "inherits": "./node_modules/inherits/inherits.js",
        "bn.js": "./node_modules/bn.js/lib/bn.js"
      },
      "./node_modules/codecov/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "teeny-request": "./node_modules/teeny-request/build/src/index.js",
        "ignore-walk": "./node_modules/ignore-walk/index.js",
        "js-yaml": "./node_modules/js-yaml/index.js",
        "urlgrey": "./node_modules/urlgrey/index.js",
        "argv": "./node_modules/argv/index.js"
      },
      "./node_modules/esquery/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "estraverse": "./node_modules/estraverse/estraverse.js"
      },
      "./node_modules/figures/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "escape-string-regexp": "./node_modules/escape-string-regexp/index.js"
      },
      "./node_modules/find-up/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "locate-path": "./node_modules/locate-path/index.js"
      },
      "./node_modules/hash.js/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "minimalistic-assert": "./node_modules/minimalistic-assert/index.js",
        "inherits": "./node_modules/inherits/inherits.js"
      },
      "./node_modules/is-glob/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "is-extglob": "./node_modules/is-extglob/index.js"
      },
      "./node_modules/js-yaml/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "argparse": "./node_modules/argparse/index.js",
        "esprima": "./node_modules/esprima/dist/esprima.js"
      },
      "./node_modules/levelup/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "deferred-leveldown": "./node_modules/deferred-leveldown/deferred-leveldown.js",
        "readable-stream": "./node_modules/levelup/node_modules/readable-stream/readable.js",
        "semver": "./node_modules/levelup/node_modules/semver/semver.js",
        "errno": "./node_modules/errno/errno.js",
        "xtend": "./node_modules/levelup/node_modules/xtend/index.js",
        "prr": "./node_modules/levelup/node_modules/prr/prr.js",
        "bl": "./node_modules/bl/bl.js"
      },
      "./node_modules/onetime/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "mimic-fn": "./node_modules/mimic-fn/index.js"
      },
      "./node_modules/p-limit/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "p-try": "./node_modules/p-try/index.js"
      },
      "./node_modules/pkg-dir/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "find-up": "./node_modules/find-up/index.js"
      },
      "./node_modules/resolve/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "path-parse": "./node_modules/path-parse/index.js"
      },
      "./node_modules/des.js/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "minimalistic-assert": "./node_modules/minimalistic-assert/index.js",
        "inherits": "./node_modules/inherits/inherits.js"
      },
      "./node_modules/eslint/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "json-stable-stringify-without-jsonify": "./node_modules/json-stable-stringify-without-jsonify/index.js",
        "functional-red-black-tree": "./node_modules/functional-red-black-tree/rbtree.js",
        "eslint-visitor-keys": "./node_modules/eslint-visitor-keys/lib/index.js",
        "strip-json-comments": "./node_modules/strip-json-comments/index.js",
        "@babel/code-frame": "./node_modules/@babel/code-frame/lib/index.js",
        "file-entry-cache": "./node_modules/file-entry-cache/cache.js",
        "v8-compile-cache": "./node_modules/v8-compile-cache/v8-compile-cache.js",
        "natural-compare": "./node_modules/natural-compare/index.js",
        "eslint-scope": "./node_modules/eslint/node_modules/eslint-scope/lib/index.js",
        "eslint-utils": "./node_modules/eslint-utils/index.mjs",
        "import-fresh": "./node_modules/import-fresh/index.js",
        "cross-spawn": "./node_modules/cross-spawn/index.js",
        "glob-parent": "./node_modules/glob-parent/index.js",
        "imurmurhash": "./node_modules/imurmurhash/imurmurhash.js",
        "optionator": "./node_modules/optionator/lib/index.js",
        "strip-ansi": "./node_modules/strip-ansi/index.js",
        "text-table": "./node_modules/text-table/index.js",
        "minimatch": "./node_modules/minimatch/minimatch.js",
        "doctrine": "./node_modules/eslint/node_modules/doctrine/lib/doctrine.js",
        "inquirer": "./node_modules/inquirer/lib/inquirer.js",
        "progress": "./node_modules/progress/index.js",
        "esquery": "./node_modules/esquery/esquery.js",
        "esutils": "./node_modules/esutils/lib/utils.js",
        "globals": "./node_modules/globals/index.js",
        "is-glob": "./node_modules/is-glob/index.js",
        "js-yaml": "./node_modules/js-yaml/index.js",
        "regexpp": "./node_modules/regexpp/index.js",
        "espree": "./node_modules/espree/espree.js",
        "ignore": "./node_modules/ignore/index.js",
        "lodash": "./node_modules/lodash/lodash.js",
        "mkdirp": "./node_modules/mkdirp/index.js",
        "semver": "./node_modules/eslint/node_modules/semver/semver.js",
        "chalk": "./node_modules/chalk/index.js",
        "debug": "./node_modules/debug/src/index.js",
        "table": "./node_modules/table/dist/index.js",
        "levn": "./node_modules/levn/lib/index.js",
        "ajv": "./node_modules/ajv/lib/ajv.js"
      },
      "./node_modules/espree/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "eslint-visitor-keys": "./node_modules/eslint-visitor-keys/lib/index.js",
        "acorn-jsx": "./node_modules/acorn-jsx/index.js",
        "acorn": "./node_modules/acorn/dist/acorn.mjs"
      },
      "./node_modules/md5.js/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "safe-buffer": "./node_modules/safe-buffer/index.js",
        "hash-base": "./node_modules/hash-base/index.js",
        "inherits": "./node_modules/inherits/inherits.js"
      },
      "./node_modules/mkdirp/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "minimist": "./node_modules/minimist/index.js"
      },
      "./node_modules/pbkdf2/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "create-hash": "./node_modules/create-hash/index.js",
        "create-hmac": "./node_modules/create-hmac/index.js",
        "safe-buffer": "./node_modules/safe-buffer/index.js",
        "ripemd160": "./node_modules/ripemd160/index.js",
        "sha.js": "./node_modules/sha.js/index.js"
      },
      "./node_modules/rimraf/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "glob": "./node_modules/glob/glob.js"
      },
      "./node_modules/rollup/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "acorn": "./node_modules/rollup/node_modules/acorn/dist/acorn.mjs"
      },
      "./node_modules/sha.js/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "safe-buffer": "./node_modules/safe-buffer/index.js",
        "inherits": "./node_modules/inherits/inherits.js"
      },
      "./node_modules/terser/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "source-map-support": "./node_modules/source-map-support/source-map-support.js",
        "source-map": "./node_modules/terser/node_modules/source-map/source-map.js",
        "commander": "./node_modules/commander/index.js"
      },
      "./node_modules/uri-js/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "punycode": "./node_modules/punycode/punycode.es6.js"
      },
      "./node_modules/chalk/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "escape-string-regexp": "./node_modules/escape-string-regexp/index.js",
        "supports-color": "./node_modules/supports-color/index.js",
        "ansi-styles": "./node_modules/ansi-styles/index.js"
      },
      "./node_modules/debug/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "ms": "./node_modules/ms/index.js"
      },
      "./node_modules/errno/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "prr": "./node_modules/prr/prr.js"
      },
      "./node_modules/json5/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "minimist": "./node_modules/json5/node_modules/minimist/index.js"
      },
      "./node_modules/react/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "object-assign": "./node_modules/object-assign/index.js",
        "loose-envify": "./node_modules/loose-envify/index.js",
        "prop-types": "./node_modules/prop-types/index.js"
      },
      "./node_modules/table/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "string-width": "./node_modules/table/node_modules/string-width/index.js",
        "slice-ansi": "./node_modules/slice-ansi/index.js",
        "lodash": "./node_modules/lodash/lodash.js",
        "ajv": "./node_modules/ajv/lib/ajv.js"
      },
      "./node_modules/which/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "isexe": "./node_modules/isexe/index.js"
      },
      "./node_modules/write/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "mkdirp": "./node_modules/mkdirp/index.js"
      },
      "./node_modules/yauzl/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "fd-slicer": "./node_modules/fd-slicer/index.js"
      },
      "./node_modules/glob/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "path-is-absolute": "./node_modules/path-is-absolute/index.js",
        "fs.realpath": "./node_modules/fs.realpath/index.js",
        "minimatch": "./node_modules/minimatch/minimatch.js",
        "inflight": "./node_modules/inflight/inflight.js",
        "inherits": "./node_modules/inherits/inherits.js",
        "once": "./node_modules/once/once.js"
      },
      "./node_modules/levn/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "prelude-ls": "./node_modules/prelude-ls/lib/index.js",
        "type-check": "./node_modules/type-check/lib/index.js"
      },
      "./node_modules/once/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "wrappy": "./node_modules/wrappy/wrappy.js"
      },
      "./node_modules/rxjs/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "tslib": "./node_modules/tslib/tslib.es6.js"
      },
      "./node_modules/ajv/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "fast-json-stable-stringify": "./node_modules/fast-json-stable-stringify/index.js",
        "json-schema-traverse": "./node_modules/json-schema-traverse/index.js",
        "fast-deep-equal": "./node_modules/fast-deep-equal/index.js",
        "uri-js": "./node_modules/uri-js/dist/es5/uri.all.js"
      },
      "./node_modules/has/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "function-bind": "./node_modules/function-bind/index.js"
      },
      "./node_modules/tmp/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "os-tmpdir": "./node_modules/os-tmpdir/index.js"
      },
      "./node_modules/bl/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "readable-stream": "./node_modules/bl/node_modules/readable-stream/readable.js"
      },
      "./node_modules/ws/": {
        "@jsenv/core/": "/node_modules/@jsenv/core/",
        "async-limiter": "./node_modules/async-limiter/index.js"
      }
    }
  };

  var nativeTypeOf = function nativeTypeOf(obj) {
    return typeof obj;
  };

  var customTypeOf = function customTypeOf(obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  };

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? nativeTypeOf : customTypeOf;

  // eslint-disable-next-line consistent-return
  var arrayWithoutHoles = (function (arr) {
    if (Array.isArray(arr)) {
      var i = 0;
      var arr2 = new Array(arr.length);

      for (; i < arr.length; i++) {
        arr2[i] = arr[i];
      }

      return arr2;
    }
  });

  // eslint-disable-next-line consistent-return
  var iterableToArray = (function (iter) {
    if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter);
  });

  var nonIterableSpread = (function () {
    throw new TypeError("Invalid attempt to spread non-iterable instance");
  });

  var _toConsumableArray = (function (arr) {
    return arrayWithoutHoles(arr) || iterableToArray(arr) || nonIterableSpread();
  });

  // https://developer.mozilla.org/en-US/docs/Glossary/Primitive
  var isComposite = function isComposite(value) {
    if (value === null) return false;

    var type = _typeof(value);

    if (type === "object") return true;
    if (type === "function") return true;
    return false;
  };

  var compositeWellKnownMap = new WeakMap();
  var primitiveWellKnownMap = new Map();
  var getCompositeGlobalPath = function getCompositeGlobalPath(value) {
    return compositeWellKnownMap.get(value);
  };
  var getPrimitiveGlobalPath = function getPrimitiveGlobalPath(value) {
    return primitiveWellKnownMap.get(value);
  };

  var visitGlobalObject = function visitGlobalObject(value) {
    var visitValue = function visitValue(value, path) {
      if (isComposite(value)) {
        if (compositeWellKnownMap.has(value)) return; // prevent infinite recursion

        compositeWellKnownMap.set(value, path);

        var visitProperty = function visitProperty(property) {
          var descriptor;

          try {
            descriptor = Object.getOwnPropertyDescriptor(value, property);
          } catch (e) {
            if (e.name === "SecurityError") {
              return;
            }

            throw e;
          } // do not trigger getter/setter


          if ("value" in descriptor) {
            var propertyValue = descriptor.value;
            visitValue(propertyValue, [].concat(_toConsumableArray(path), [property]));
          }
        };

        Object.getOwnPropertyNames(value).forEach(function (name) {
          return visitProperty(name);
        });
        Object.getOwnPropertySymbols(value).forEach(function (symbol) {
          return visitProperty(symbol);
        });
      }

      primitiveWellKnownMap.set(value, path);
      return;
    };

    visitValue(value, []);
  };

  if ((typeof window === "undefined" ? "undefined" : _typeof(window)) === "object") visitGlobalObject(window);
  if ((typeof global === "undefined" ? "undefined" : _typeof(global)) === "object") visitGlobalObject(global);

  var decompose = function decompose(mainValue, _ref) {
    var functionAllowed = _ref.functionAllowed;
    var valueMap = {};
    var recipeArray = [];

    var valueToIdentifier = function valueToIdentifier(value) {
      var path = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

      if (!isComposite(value)) {
        var _existingIdentifier = identifierForPrimitive(value);

        if (_existingIdentifier !== undefined) return _existingIdentifier;

        var _identifier = identifierForNewValue(value);

        recipeArray[_identifier] = primitiveToRecipe(value);
        return _identifier;
      }

      if (typeof Promise === "function" && value instanceof Promise) throw new Error(createPromiseAreNotSupportedMessage({
        path: path
      }));
      if (typeof WeakSet === "function" && value instanceof WeakSet) throw new Error(createWeakSetAreNotSupportedMessage({
        path: path
      }));
      if (typeof WeakMap === "function" && value instanceof WeakMap) throw new Error(createWeakMapAreNotSupportedMessage({
        path: path
      }));
      if (typeof value === "function" && !functionAllowed) throw new Error(createForbiddenFunctionMessage({
        path: path
      }));
      var existingIdentifier = identifierForComposite(value);
      if (existingIdentifier !== undefined) return existingIdentifier;
      var identifier = identifierForNewValue(value);
      var compositeGlobalPath = getCompositeGlobalPath(value);

      if (compositeGlobalPath) {
        recipeArray[identifier] = createGlobalReferenceRecipe(compositeGlobalPath);
        return identifier;
      }

      var propertyDescriptionArray = [];
      Object.getOwnPropertyNames(value).forEach(function (propertyName) {
        var propertyDescriptor = Object.getOwnPropertyDescriptor(value, propertyName);
        var propertyNameIdentifier = valueToIdentifier(propertyName, [].concat(_toConsumableArray(path), [propertyName]));
        var propertyDescription = computePropertyDescription(propertyDescriptor, propertyName, path);
        propertyDescriptionArray.push({
          propertyNameIdentifier: propertyNameIdentifier,
          propertyDescription: propertyDescription
        });
      });
      var symbolDescriptionArray = [];
      Object.getOwnPropertySymbols(value).forEach(function (symbol) {
        var propertyDescriptor = Object.getOwnPropertyDescriptor(value, symbol);
        var symbolIdentifier = valueToIdentifier(symbol, [].concat(_toConsumableArray(path), ["[".concat(symbol.toString(), "]")]));
        var propertyDescription = computePropertyDescription(propertyDescriptor, symbol, path);
        symbolDescriptionArray.push({
          symbolIdentifier: symbolIdentifier,
          propertyDescription: propertyDescription
        });
      });
      var methodDescriptionArray = computeMethodDescriptionArray(value, path);
      var extensible = Object.isExtensible(value);
      recipeArray[identifier] = createCompositeRecipe({
        propertyDescriptionArray: propertyDescriptionArray,
        symbolDescriptionArray: symbolDescriptionArray,
        methodDescriptionArray: methodDescriptionArray,
        extensible: extensible
      });
      return identifier;
    };

    var computePropertyDescription = function computePropertyDescription(propertyDescriptor, propertyNameOrSymbol, path) {
      if (propertyDescriptor.set && !functionAllowed) throw new Error(createForbiddenPropertySetterMessage({
        path: path,
        propertyNameOrSymbol: propertyNameOrSymbol
      }));
      if (propertyDescriptor.get && !functionAllowed) throw new Error(createForbiddenPropertyGetterMessage({
        path: path,
        propertyNameOrSymbol: propertyNameOrSymbol
      }));
      return {
        configurable: propertyDescriptor.configurable,
        writable: propertyDescriptor.writable,
        enumerable: propertyDescriptor.enumerable,
        getIdentifier: "get" in propertyDescriptor ? valueToIdentifier(propertyDescriptor.get, [].concat(_toConsumableArray(path), [String(propertyNameOrSymbol), "[[descriptor:get]]"])) : undefined,
        setIdentifier: "set" in propertyDescriptor ? valueToIdentifier(propertyDescriptor.set, [].concat(_toConsumableArray(path), [String(propertyNameOrSymbol), "[[descriptor:set]]"])) : undefined,
        valueIdentifier: "value" in propertyDescriptor ? valueToIdentifier(propertyDescriptor.value, [].concat(_toConsumableArray(path), [String(propertyNameOrSymbol), "[[descriptor:value]]"])) : undefined
      };
    };

    var computeMethodDescriptionArray = function computeMethodDescriptionArray(value, path) {
      var methodDescriptionArray = [];

      if (typeof Set === "function" && value instanceof Set) {
        var callArray = [];
        value.forEach(function (entryValue, index) {
          var entryValueIdentifier = valueToIdentifier(entryValue, [].concat(_toConsumableArray(path), ["[[SetEntryValue]]", index]));
          callArray.push([entryValueIdentifier]);
        });
        methodDescriptionArray.push({
          methodNameIdentifier: valueToIdentifier("add"),
          callArray: callArray
        });
      }

      if (typeof Map === "function" && value instanceof Map) {
        var _callArray = [];
        value.forEach(function (entryValue, entryKey) {
          var entryKeyIdentifier = valueToIdentifier(entryKey, [].concat(_toConsumableArray(path), ["[[MapEntryKey]]", entryKey]));
          var entryValueIdentifier = valueToIdentifier(entryValue, [].concat(_toConsumableArray(path), ["[[MapEntryValue]]", entryValue]));

          _callArray.push([entryKeyIdentifier, entryValueIdentifier]);
        });
        methodDescriptionArray.push({
          methodNameIdentifier: valueToIdentifier("set"),
          callArray: _callArray
        });
      }

      return methodDescriptionArray;
    };

    var identifierForPrimitive = function identifierForPrimitive(value) {
      return Object.keys(valueMap).find(function (existingIdentifier) {
        var existingValue = valueMap[existingIdentifier];
        if (Object.is(value, existingValue)) return true;
        return value === existingValue;
      });
    };

    var identifierForComposite = function identifierForComposite(value) {
      return Object.keys(valueMap).find(function (existingIdentifier) {
        var existingValue = valueMap[existingIdentifier];
        return value === existingValue;
      });
    };

    var identifierForNewValue = function identifierForNewValue(value) {
      var identifier = nextIdentifier();
      valueMap[identifier] = value;
      return identifier;
    };

    var currentIdentifier = -1;

    var nextIdentifier = function nextIdentifier() {
      var identifier = String(parseInt(currentIdentifier) + 1);
      currentIdentifier = identifier;
      return identifier;
    };

    var mainIdentifier = valueToIdentifier(mainValue); // prototype, important to keep after the whole structure was visited
    // so that we discover if any prototype is part of the value

    var prototypeValueToIdentifier = function prototypeValueToIdentifier(prototypeValue) {
      // prototype is null
      if (prototypeValue === null) return valueToIdentifier(prototypeValue); // prototype found somewhere already

      var prototypeExistingIdentifier = identifierForComposite(prototypeValue);
      if (prototypeExistingIdentifier !== undefined) return prototypeExistingIdentifier; // mark prototype as visited

      var prototypeIdentifier = identifierForNewValue(prototypeValue); // prototype is a global reference ?

      var prototypeGlobalPath = getCompositeGlobalPath(prototypeValue);

      if (prototypeGlobalPath) {
        recipeArray[prototypeIdentifier] = createGlobalReferenceRecipe(prototypeGlobalPath);
        return prototypeIdentifier;
      } // otherwise prototype is unknown


      throw new Error(createUnknownPrototypeMessage({
        prototypeValue: prototypeValue
      }));
    };

    var identifierForValueOf = function identifierForValueOf(value) {
      var path = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
      if (value instanceof Array) return valueToIdentifier(value.length, [].concat(_toConsumableArray(path), ["length"]));
      if ("valueOf" in value === false) return undefined;
      if (typeof value.valueOf !== "function") return undefined;
      var valueOfReturnValue = value.valueOf();
      if (!isComposite(valueOfReturnValue)) return valueToIdentifier(valueOfReturnValue, [].concat(_toConsumableArray(path), ["valueOf()"]));
      if (valueOfReturnValue === value) return undefined;
      throw new Error(createUnexpectedValueOfReturnValueMessage());
    };

    recipeArray.slice().forEach(function (recipe, index) {
      if (recipe.type === "composite") {
        var value = valueMap[index];

        if (typeof value === "function") {
          var valueOfIdentifier = nextIdentifier();
          recipeArray[valueOfIdentifier] = {
            type: "primitive",
            value: value
          };
          recipe.valueOfIdentifier = valueOfIdentifier;
          return;
        }

        if (value instanceof RegExp) {
          var _valueOfIdentifier = nextIdentifier();

          recipeArray[_valueOfIdentifier] = {
            type: "primitive",
            value: value
          };
          recipe.valueOfIdentifier = _valueOfIdentifier;
          return;
        } // valueOf, mandatory to uneval new Date(10) for instance.


        recipe.valueOfIdentifier = identifierForValueOf(value);
        var prototypeValue = Object.getPrototypeOf(value);
        recipe.prototypeIdentifier = prototypeValueToIdentifier(prototypeValue);
      }
    });
    return {
      recipeArray: recipeArray,
      mainIdentifier: mainIdentifier,
      valueMap: valueMap
    };
  };

  var primitiveToRecipe = function primitiveToRecipe(value) {
    if (_typeof(value) === "symbol") return symbolToRecipe(value);
    return createPimitiveRecipe(value);
  };

  var symbolToRecipe = function symbolToRecipe(symbol) {
    var globalSymbolKey = Symbol.keyFor(symbol);
    if (globalSymbolKey !== undefined) return createGlobalSymbolRecipe(globalSymbolKey);
    var symbolGlobalPath = getPrimitiveGlobalPath(symbol);
    if (!symbolGlobalPath) throw new Error(createUnknownSymbolMessage({
      symbol: symbol
    }));
    return createGlobalReferenceRecipe(symbolGlobalPath);
  };

  var createPimitiveRecipe = function createPimitiveRecipe(value) {
    return {
      type: "primitive",
      value: value
    };
  };

  var createGlobalReferenceRecipe = function createGlobalReferenceRecipe(path) {
    var recipe = {
      type: "global-reference",
      path: path
    };
    return recipe;
  };

  var createGlobalSymbolRecipe = function createGlobalSymbolRecipe(key) {
    return {
      type: "global-symbol",
      key: key
    };
  };

  var createCompositeRecipe = function createCompositeRecipe(_ref2) {
    var prototypeIdentifier = _ref2.prototypeIdentifier,
        valueOfIdentifier = _ref2.valueOfIdentifier,
        propertyDescriptionArray = _ref2.propertyDescriptionArray,
        symbolDescriptionArray = _ref2.symbolDescriptionArray,
        methodDescriptionArray = _ref2.methodDescriptionArray,
        extensible = _ref2.extensible;
    return {
      type: "composite",
      prototypeIdentifier: prototypeIdentifier,
      valueOfIdentifier: valueOfIdentifier,
      propertyDescriptionArray: propertyDescriptionArray,
      symbolDescriptionArray: symbolDescriptionArray,
      methodDescriptionArray: methodDescriptionArray,
      extensible: extensible
    };
  };

  var createPromiseAreNotSupportedMessage = function createPromiseAreNotSupportedMessage(_ref3) {
    var path = _ref3.path;
    if (path.length === 0) return "promise are not supported.";
    return "promise are not supported.\npromise found at: ".concat(path.join(""));
  };

  var createWeakSetAreNotSupportedMessage = function createWeakSetAreNotSupportedMessage(_ref4) {
    var path = _ref4.path;
    if (path.length === 0) return "weakSet are not supported.";
    return "weakSet are not supported.\nweakSet found at: ".concat(path.join(""));
  };

  var createWeakMapAreNotSupportedMessage = function createWeakMapAreNotSupportedMessage(_ref5) {
    var path = _ref5.path;
    if (path.length === 0) return "weakMap are not supported.";
    return "weakMap are not supported.\nweakMap found at: ".concat(path.join(""));
  };

  var createForbiddenFunctionMessage = function createForbiddenFunctionMessage(_ref6) {
    var path = _ref6.path;
    if (path.length === 0) return "function are not allowed.";
    return "function are not allowed.\nfunction found at: ".concat(path.join(""));
  };

  var createForbiddenPropertyGetterMessage = function createForbiddenPropertyGetterMessage(_ref7) {
    var path = _ref7.path,
        propertyNameOrSymbol = _ref7.propertyNameOrSymbol;
    return "property getter are not allowed.\ngetter found on property: ".concat(String(propertyNameOrSymbol), "\nat: ").concat(path.join(""));
  };

  var createForbiddenPropertySetterMessage = function createForbiddenPropertySetterMessage(_ref8) {
    var path = _ref8.path,
        propertyNameOrSymbol = _ref8.propertyNameOrSymbol;
    return "property setter are not allowed.\nsetter found on property: ".concat(String(propertyNameOrSymbol), "\nat: ").concat(path.join(""));
  };

  var createUnexpectedValueOfReturnValueMessage = function createUnexpectedValueOfReturnValueMessage() {
    return "valueOf() must return a primitive of the object itself.";
  };

  var createUnknownSymbolMessage = function createUnknownSymbolMessage(_ref9) {
    var symbol = _ref9.symbol;
    return "symbol must be global, like Symbol.iterator, or created using Symbol.for().\nsymbol: ".concat(symbol.toString());
  };

  var createUnknownPrototypeMessage = function createUnknownPrototypeMessage(_ref10) {
    var prototypeValue = _ref10.prototypeValue;
    return "prototype must be global, like Object.prototype, or somewhere in the value.\nprototype constructor name: ".concat(prototypeValue.constructor.name);
  };

  // be carefull because this function is mutating recipe objects inside the recipeArray.
  // this is not an issue because each recipe object is not accessible from the outside
  // when used internally by uneval
  var sortRecipe = function sortRecipe(recipeArray) {
    var findInRecipePrototypeChain = function findInRecipePrototypeChain(recipe, callback) {
      var currentRecipe = recipe; // eslint-disable-next-line no-constant-condition

      while (true) {
        if (currentRecipe.type !== "composite") break;
        var prototypeIdentifier = currentRecipe.prototypeIdentifier;
        if (prototypeIdentifier === undefined) break;
        currentRecipe = recipeArray[prototypeIdentifier];
        if (callback(currentRecipe, prototypeIdentifier)) return prototypeIdentifier;
      }

      return undefined;
    };

    var recipeArrayOrdered = recipeArray.slice();
    recipeArrayOrdered.sort(function (leftRecipe, rightRecipe) {
      var leftType = leftRecipe.type;
      var rightType = rightRecipe.type;

      if (leftType === "composite" && rightType === "composite") {
        var rightRecipeIsInLeftRecipePrototypeChain = findInRecipePrototypeChain(leftRecipe, function (recipeCandidate) {
          return recipeCandidate === rightRecipe;
        }); // if left recipe requires right recipe, left must be after right

        if (rightRecipeIsInLeftRecipePrototypeChain) return 1;
        var leftRecipeIsInRightRecipePrototypeChain = findInRecipePrototypeChain(rightRecipe, function (recipeCandidate) {
          return recipeCandidate === leftRecipe;
        }); // if right recipe requires left recipe, right must be after left

        if (leftRecipeIsInRightRecipePrototypeChain) return -1;
      }

      if (leftType !== rightType) {
        // if left is a composite, left must be after right
        if (leftType === "composite") return 1; // if right is a composite, right must be after left

        if (rightType === "composite") return -1;
      }

      var leftIndex = recipeArray.indexOf(leftRecipe);
      var rightIndex = recipeArray.indexOf(rightRecipe); // left was before right, don't change that

      if (leftIndex < rightIndex) return -1; // right was after left, don't change that

      return 1;
    });
    return recipeArrayOrdered;
  };

  // https://github.com/joliss/js-string-escape/blob/master/index.js
  // http://javascript.crockford.com/remedial.html
  var escapeString = function escapeString(value) {
    var string = String(value);
    var i = 0;
    var j = string.length;
    var escapedString = "";

    while (i < j) {
      var char = string[i];
      var escapedChar = void 0;

      if (char === '"' || char === "'" || char === "\\") {
        escapedChar = "\\".concat(char);
      } else if (char === "\n") {
        escapedChar = "\\n";
      } else if (char === "\r") {
        escapedChar = "\\r";
      } else if (char === "\u2028") {
        escapedChar = "\\u2028";
      } else if (char === "\u2029") {
        escapedChar = "\\u2029";
      } else {
        escapedChar = char;
      }

      escapedString += escapedChar;
      i++;
    }

    return escapedString;
  };

  var uneval = function uneval(value) {
    var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref$functionAllowed = _ref.functionAllowed,
        functionAllowed = _ref$functionAllowed === void 0 ? false : _ref$functionAllowed;

    var _decompose = decompose(value, {
      functionAllowed: functionAllowed
    }),
        recipeArray = _decompose.recipeArray,
        mainIdentifier = _decompose.mainIdentifier,
        valueMap = _decompose.valueMap;

    var recipeArraySorted = sortRecipe(recipeArray);
    var source = "(function () {\nObject.defineProperty(Object.prototype, \"__global__\", {\n  get: function () { return this },\n  configurable: true,\n});\nvar globalObject = __global__;\ndelete Object.prototype.__global__;\n\nfunction safeDefineProperty(object, propertyNameOrSymbol, descriptor) {\n  var currentDescriptor = Object.getOwnPropertyDescriptor(object, propertyNameOrSymbol);\n  if (currentDescriptor && !currentDescriptor.configurable) return\n  Object.defineProperty(object, propertyNameOrSymbol, descriptor)\n};\n";
    var variableNameMap = {};
    recipeArray.forEach(function (recipe, index) {
      var indexSorted = recipeArraySorted.indexOf(recipe);
      variableNameMap[index] = "_".concat(indexSorted);
    });

    var identifierToVariableName = function identifierToVariableName(identifier) {
      return variableNameMap[identifier];
    };

    var recipeToSetupSource = function recipeToSetupSource(recipe) {
      if (recipe.type === "primitive") return primitiveRecipeToSetupSource(recipe);
      if (recipe.type === "global-symbol") return globalSymbolRecipeToSetupSource(recipe);
      if (recipe.type === "global-reference") return globalReferenceRecipeToSetupSource(recipe);
      return compositeRecipeToSetupSource(recipe);
    };

    var primitiveRecipeToSetupSource = function primitiveRecipeToSetupSource(_ref2) {
      var value = _ref2.value;
      if (typeof value === "string") return "\"".concat(escapeString(value), "\";");
      if (Object.is(value, -0)) return "-0;";
      return "".concat(String(value), ";");
    };

    var globalSymbolRecipeToSetupSource = function globalSymbolRecipeToSetupSource(recipe) {
      return "Symbol.for(\"".concat(escapeString(recipe.key), "\");");
    };

    var globalReferenceRecipeToSetupSource = function globalReferenceRecipeToSetupSource(recipe) {
      var pathSource = recipe.path.map(function (part) {
        return "[\"".concat(escapeString(part), "\"]");
      }).join("");
      return "globalObject".concat(pathSource, ";");
    };

    var compositeRecipeToSetupSource = function compositeRecipeToSetupSource(_ref3) {
      var prototypeIdentifier = _ref3.prototypeIdentifier,
          valueOfIdentifier = _ref3.valueOfIdentifier;
      if (prototypeIdentifier === undefined) return identifierToVariableName(valueOfIdentifier);
      var prototypeValue = valueMap[prototypeIdentifier];
      if (prototypeValue === null) return "Object.create(null);";
      var prototypeConstructor = prototypeValue.constructor;
      if (prototypeConstructor === Object) return "Object.create(".concat(identifierToVariableName(prototypeIdentifier), ");");
      if (valueOfIdentifier === undefined) return "new ".concat(prototypeConstructor.name, "();");
      return "new ".concat(prototypeConstructor.name, "(").concat(identifierToVariableName(valueOfIdentifier), ");");
    };

    recipeArraySorted.forEach(function (recipe) {
      var recipeVariableName = identifierToVariableName(recipeArray.indexOf(recipe));
      source += "var ".concat(recipeVariableName, " = ").concat(recipeToSetupSource(recipe), "\n");
    });

    var recipeToMutateSource = function recipeToMutateSource(recipe, recipeVariableName) {
      if (recipe.type === "composite") return compositeRecipeToMutateSource(recipe, recipeVariableName);
      return "";
    };

    var compositeRecipeToMutateSource = function compositeRecipeToMutateSource(_ref4, recipeVariableName) {
      var propertyDescriptionArray = _ref4.propertyDescriptionArray,
          symbolDescriptionArray = _ref4.symbolDescriptionArray,
          methodDescriptionArray = _ref4.methodDescriptionArray,
          extensible = _ref4.extensible;
      var mutateSource = "";
      propertyDescriptionArray.forEach(function (_ref5) {
        var propertyNameIdentifier = _ref5.propertyNameIdentifier,
            propertyDescription = _ref5.propertyDescription;
        mutateSource += generateDefinePropertySource(recipeVariableName, propertyNameIdentifier, propertyDescription);
      });
      symbolDescriptionArray.forEach(function (_ref6) {
        var symbolIdentifier = _ref6.symbolIdentifier,
            propertyDescription = _ref6.propertyDescription;
        mutateSource += generateDefinePropertySource(recipeVariableName, symbolIdentifier, propertyDescription);
      });
      methodDescriptionArray.forEach(function (_ref7) {
        var methodNameIdentifier = _ref7.methodNameIdentifier,
            callArray = _ref7.callArray;
        mutateSource += generateMethodCallSource(recipeVariableName, methodNameIdentifier, callArray);
      });

      if (!extensible) {
        mutateSource += generatePreventExtensionSource(recipeVariableName);
      }

      return mutateSource;
    };

    var generateDefinePropertySource = function generateDefinePropertySource(recipeVariableName, propertyNameOrSymbolIdentifier, propertyDescription) {
      var propertyOrSymbolVariableName = identifierToVariableName(propertyNameOrSymbolIdentifier);
      var propertyDescriptorSource = generatePropertyDescriptorSource(propertyDescription);
      return "safeDefineProperty(".concat(recipeVariableName, ", ").concat(propertyOrSymbolVariableName, ", ").concat(propertyDescriptorSource, ");");
    };

    var generatePropertyDescriptorSource = function generatePropertyDescriptorSource(_ref8) {
      var configurable = _ref8.configurable,
          writable = _ref8.writable,
          enumerable = _ref8.enumerable,
          getIdentifier = _ref8.getIdentifier,
          setIdentifier = _ref8.setIdentifier,
          valueIdentifier = _ref8.valueIdentifier;

      if (valueIdentifier === undefined) {
        return "{\n  configurable: ".concat(configurable, ",\n  enumerable: ").concat(enumerable, ",\n  get: ").concat(getIdentifier === undefined ? undefined : identifierToVariableName(getIdentifier), ",\n  set: ").concat(setIdentifier === undefined ? undefined : identifierToVariableName(setIdentifier), ",\n}");
      }

      return "{\n  configurable: ".concat(configurable, ",\n  writable: ").concat(writable, ",\n  enumerable: ").concat(enumerable, ",\n  value: ").concat(valueIdentifier === undefined ? undefined : identifierToVariableName(valueIdentifier), "\n}");
    };

    var generateMethodCallSource = function generateMethodCallSource(recipeVariableName, methodNameIdentifier, callArray) {
      var methodCallSource = "";
      var methodVariableName = identifierToVariableName(methodNameIdentifier);
      callArray.forEach(function (argumentIdentifiers) {
        var argumentVariableNames = argumentIdentifiers.map(function (argumentIdentifier) {
          return identifierToVariableName(argumentIdentifier);
        });
        methodCallSource += "".concat(recipeVariableName, "[").concat(methodVariableName, "](").concat(argumentVariableNames.join(","), ");");
      });
      return methodCallSource;
    };

    var generatePreventExtensionSource = function generatePreventExtensionSource(recipeVariableName) {
      return "Object.preventExtensions(".concat(recipeVariableName, ");");
    };

    recipeArraySorted.forEach(function (recipe) {
      var recipeVariableName = identifierToVariableName(recipeArray.indexOf(recipe));
      source += "".concat(recipeToMutateSource(recipe, recipeVariableName));
    });
    source += "return ".concat(identifierToVariableName(mainIdentifier), "; })()");
    return source;
  };

  var OTHERWISE_ID = "otherwise";

  var computeCompileIdFromGroupId = function computeCompileIdFromGroupId(_ref) {
    var groupId = _ref.groupId,
        groupMap = _ref.groupMap;

    if (typeof groupId === "undefined") {
      if (OTHERWISE_ID in groupMap) return OTHERWISE_ID;
      var keys = Object.keys(groupMap);
      if (keys.length === 1) return keys[0];
      throw new Error(createUnexpectedGroupIdMessage({
        groupMap: groupMap
      }));
    }

    if (groupId in groupMap === false) throw new Error(createUnexpectedGroupIdMessage({
      groupId: groupId,
      groupMap: groupMap
    }));
    return groupId;
  };

  var createUnexpectedGroupIdMessage = function createUnexpectedGroupIdMessage(_ref2) {
    var compileId = _ref2.compileId,
        groupMap = _ref2.groupMap;
    return "unexpected groupId.\n--- expected compiled id ----\n".concat(Object.keys(groupMap), "\n--- received compile id ---\n").concat(compileId);
  };

  var valueToVersion = function valueToVersion(value) {
    if (typeof value === "number") {
      return numberToVersion(value);
    }

    if (typeof value === "string") {
      return stringToVersion(value);
    }

    throw new TypeError(createValueErrorMessage({
      version: value
    }));
  };

  var numberToVersion = function numberToVersion(number) {
    return {
      major: number,
      minor: 0,
      patch: 0
    };
  };

  var stringToVersion = function stringToVersion(string) {
    if (string.indexOf(".") > -1) {
      var parts = string.split(".");
      return {
        major: Number(parts[0]),
        minor: parts[1] ? Number(parts[1]) : 0,
        patch: parts[2] ? Number(parts[2]) : 0
      };
    }

    if (isNaN(string)) {
      return {
        major: 0,
        minor: 0,
        patch: 0
      };
    }

    return {
      major: Number(string),
      minor: 0,
      patch: 0
    };
  };

  var createValueErrorMessage = function createValueErrorMessage(_ref) {
    var value = _ref.value;
    return "value must be a number or a string.\nvalue: ".concat(value);
  };

  var versionCompare = function versionCompare(versionA, versionB) {
    var semanticVersionA = valueToVersion(versionA);
    var semanticVersionB = valueToVersion(versionB);
    var majorDiff = semanticVersionA.major - semanticVersionB.major;

    if (majorDiff > 0) {
      return majorDiff;
    }

    if (majorDiff < 0) {
      return majorDiff;
    }

    var minorDiff = semanticVersionA.minor - semanticVersionB.minor;

    if (minorDiff > 0) {
      return minorDiff;
    }

    if (minorDiff < 0) {
      return minorDiff;
    }

    var patchDiff = semanticVersionA.patch - semanticVersionB.patch;

    if (patchDiff > 0) {
      return patchDiff;
    }

    if (patchDiff < 0) {
      return patchDiff;
    }

    return 0;
  };

  var versionIsBelow = function versionIsBelow(versionSupposedBelow, versionSupposedAbove) {
    return versionCompare(versionSupposedBelow, versionSupposedAbove) < 0;
  };

  var findHighestVersion = function findHighestVersion() {
    for (var _len = arguments.length, values = new Array(_len), _key = 0; _key < _len; _key++) {
      values[_key] = arguments[_key];
    }

    if (values.length === 0) throw new Error("missing argument");
    return values.reduce(function (highestVersion, value) {
      if (versionIsBelow(highestVersion, value)) {
        return value;
      }

      return highestVersion;
    });
  };

  var resolveGroup = function resolveGroup(_ref, _ref2) {
    var name = _ref.name,
        version = _ref.version;
    var groupMap = _ref2.groupMap;
    return Object.keys(groupMap).find(function (compileIdCandidate) {
      var platformCompatMap = groupMap[compileIdCandidate].platformCompatMap;

      if (name in platformCompatMap === false) {
        return false;
      }

      var versionForGroup = platformCompatMap[name];
      var highestVersion = findHighestVersion(version, versionForGroup);
      return highestVersion === version;
    });
  };

  var firstMatch = function firstMatch(regexp, string) {
    var match = string.match(regexp);
    return match && match.length > 0 ? match[1] || undefined : undefined;
  };
  var secondMatch = function secondMatch(regexp, string) {
    var match = string.match(regexp);
    return match && match.length > 1 ? match[2] || undefined : undefined;
  };
  var userAgentToVersion = function userAgentToVersion(userAgent) {
    return firstMatch(/version\/(\d+(\.?_?\d+)+)/i, userAgent) || undefined;
  };

  var detectAndroid = function detectAndroid() {
    return navigatorToBrowser(window.navigator);
  };

  var navigatorToBrowser = function navigatorToBrowser(_ref) {
    var userAgent = _ref.userAgent,
        appVersion = _ref.appVersion;

    if (/(android)/i.test(userAgent)) {
      return {
        name: "android",
        version: firstMatch(/Android (\d+(\.?_?\d+)+)/i, appVersion)
      };
    }

    return null;
  };

  var detectInternetExplorer = function detectInternetExplorer() {
    return userAgentToBrowser(window.navigator.userAgent);
  };

  var userAgentToBrowser = function userAgentToBrowser(userAgent) {
    if (/msie|trident/i.test(userAgent)) {
      return {
        name: "ie",
        version: firstMatch(/(?:msie |rv:)(\d+(\.?_?\d+)+)/i, userAgent)
      };
    }

    return null;
  };

  var detectOpera = function detectOpera() {
    return userAgentToBrowser$1(window.navigator.userAgent);
  };

  var userAgentToBrowser$1 = function userAgentToBrowser(userAgent) {
    // opera below 13
    if (/opera/i.test(userAgent)) {
      return {
        name: "opera",
        version: userAgentToVersion(userAgent) || firstMatch(/(?:opera)[\s/](\d+(\.?_?\d+)+)/i, userAgent)
      };
    } // opera above 13


    if (/opr\/|opios/i.test(userAgent)) {
      return {
        name: "opera",
        version: firstMatch(/(?:opr|opios)[\s/](\S+)/i, userAgent) || userAgentToVersion(userAgent)
      };
    }

    return null;
  };

  var detectEdge = function detectEdge() {
    return userAgentToBrowser$2(window.navigator.userAgent);
  };

  var userAgentToBrowser$2 = function userAgentToBrowser(userAgent) {
    if (/edg([ea]|ios)/i.test(userAgent)) {
      return {
        name: "edge",
        version: secondMatch(/edg([ea]|ios)\/(\d+(\.?_?\d+)+)/i, userAgent)
      };
    }

    return null;
  };

  var detectFirefox = function detectFirefox() {
    return userAgentToBrowser$3(window.navigator.userAgent);
  };

  var userAgentToBrowser$3 = function userAgentToBrowser(userAgent) {
    if (/firefox|iceweasel|fxios/i.test(userAgent)) {
      return {
        name: "firefox",
        version: firstMatch(/(?:firefox|iceweasel|fxios)[\s/](\d+(\.?_?\d+)+)/i, userAgent)
      };
    }

    return null;
  };

  var detectChrome = function detectChrome() {
    return userAgentToBrowser$4(window.navigator.userAgent);
  };

  var userAgentToBrowser$4 = function userAgentToBrowser(userAgent) {
    if (/chromium/i.test(userAgent)) {
      return {
        name: "chrome",
        version: firstMatch(/(?:chromium)[\s/](\d+(\.?_?\d+)+)/i, userAgent) || userAgentToVersion(userAgent)
      };
    }

    if (/chrome|crios|crmo/i.test(userAgent)) {
      return {
        name: "chrome",
        version: firstMatch(/(?:chrome|crios|crmo)\/(\d+(\.?_?\d+)+)/i, userAgent)
      };
    }

    return null;
  };

  var detectSafari = function detectSafari() {
    return userAgentToBrowser$5(window.navigator.userAgent);
  };

  var userAgentToBrowser$5 = function userAgentToBrowser(userAgent) {
    if (/safari|applewebkit/i.test(userAgent)) {
      return {
        name: "safari",
        version: userAgentToVersion(userAgent)
      };
    }

    return null;
  };

  var detectElectron = function detectElectron() {
    return null;
  }; // TODO

  var detectIOS = function detectIOS() {
    return navigatorToBrowser$1(window.navigator);
  };

  var navigatorToBrowser$1 = function navigatorToBrowser(_ref) {
    var userAgent = _ref.userAgent,
        appVersion = _ref.appVersion;

    if (/iPhone;/.test(userAgent)) {
      return {
        name: "ios",
        version: firstMatch(/OS (\d+(\.?_?\d+)+)/i, appVersion)
      };
    }

    if (/iPad;/.test(userAgent)) {
      return {
        name: "ios",
        version: firstMatch(/OS (\d+(\.?_?\d+)+)/i, appVersion)
      };
    }

    return null;
  };

  // https://github.com/Ahmdrza/detect-browser/blob/26254f85cf92795655a983bfd759d85f3de850c6/detect-browser.js#L1

  var detectorCompose = function detectorCompose(detectors) {
    return function () {
      var i = 0;

      while (i < detectors.length) {
        var _detector = detectors[i];
        i++;

        var result = _detector();

        if (result) {
          return result;
        }
      }

      return null;
    };
  };

  var detector = detectorCompose([detectOpera, detectInternetExplorer, detectEdge, detectFirefox, detectChrome, detectSafari, detectElectron, detectIOS, detectAndroid]);
  var detectBrowser = function detectBrowser() {
    var _ref = detector() || {},
        _ref$name = _ref.name,
        name = _ref$name === void 0 ? "other" : _ref$name,
        _ref$version = _ref.version,
        version = _ref$version === void 0 ? "unknown" : _ref$version;

    return {
      name: normalizeName(name),
      version: normalizeVersion(version)
    };
  };

  var normalizeName = function normalizeName(name) {
    return name.toLowerCase();
  };

  var normalizeVersion = function normalizeVersion(version) {
    if (version.indexOf(".") > -1) {
      var parts = version.split("."); // remove extraneous .

      return parts.slice(0, 3).join(".");
    }

    if (version.indexOf("_") > -1) {
      var _parts = version.split("_"); // remove extraneous _


      return _parts.slice(0, 3).join("_");
    }

    return version;
  };

  var resolveBrowserGroup = function resolveBrowserGroup(_ref) {
    var groupMap = _ref.groupMap;
    return resolveGroup(detectBrowser(), {
      groupMap: groupMap
    });
  };

  var assertImportMap = function assertImportMap(value) {
    if (value === null) {
      throw new TypeError("an importMap must be an object, got null");
    }

    var type = _typeof(value);

    if (type !== "object") {
      throw new TypeError("an importMap must be an object, received ".concat(value));
    }

    if (Array.isArray(value)) {
      throw new TypeError("an importMap must be an object, received array ".concat(value));
    }
  };

  var hasScheme = function hasScheme(string) {
    return /^[a-zA-Z]{2,}:/.test(string);
  };

  var hrefToScheme = function hrefToScheme(href) {
    var colonIndex = href.indexOf(":");
    if (colonIndex === -1) return "";
    return href.slice(0, colonIndex);
  };

  var hrefToPathname = function hrefToPathname(href) {
    return ressourceToPathname(hrefToRessource(href));
  };

  var hrefToRessource = function hrefToRessource(href) {
    var scheme = hrefToScheme(href);

    if (scheme === "file") {
      return href.slice("file://".length);
    }

    if (scheme === "https" || scheme === "http") {
      // remove origin
      var afterProtocol = href.slice(scheme.length + "://".length);
      var pathnameSlashIndex = afterProtocol.indexOf("/", "://".length);
      return afterProtocol.slice(pathnameSlashIndex);
    }

    return href.slice(scheme.length + 1);
  };

  var ressourceToPathname = function ressourceToPathname(ressource) {
    var searchSeparatorIndex = ressource.indexOf("?");
    return searchSeparatorIndex === -1 ? ressource : ressource.slice(0, searchSeparatorIndex);
  };

  var hrefToOrigin = function hrefToOrigin(href) {
    var scheme = hrefToScheme(href);

    if (scheme === "file") {
      return "file://";
    }

    if (scheme === "http" || scheme === "https") {
      var secondProtocolSlashIndex = scheme.length + "://".length;
      var pathnameSlashIndex = href.indexOf("/", secondProtocolSlashIndex);
      if (pathnameSlashIndex === -1) return href;
      return href.slice(0, pathnameSlashIndex);
    }

    return href.slice(0, scheme.length + 1);
  };

  var pathnameToDirname = function pathnameToDirname(pathname) {
    var slashLastIndex = pathname.lastIndexOf("/");
    if (slashLastIndex === -1) return "";
    return pathname.slice(0, slashLastIndex);
  };

  // could be useful: https://url.spec.whatwg.org/#url-miscellaneous
  var resolveUrl = function resolveUrl(specifier, baseUrl) {
    if (baseUrl) {
      if (typeof baseUrl !== "string") {
        throw new TypeError(writeBaseUrlMustBeAString({
          baseUrl: baseUrl,
          specifier: specifier
        }));
      }

      if (!hasScheme(baseUrl)) {
        throw new Error(writeBaseUrlMustBeAbsolute({
          baseUrl: baseUrl,
          specifier: specifier
        }));
      }
    }

    if (hasScheme(specifier)) {
      return specifier;
    }

    if (!baseUrl) {
      throw new Error(writeBaseUrlRequired({
        baseUrl: baseUrl,
        specifier: specifier
      }));
    } // scheme relative


    if (specifier.slice(0, 2) === "//") {
      return "".concat(hrefToScheme(baseUrl), ":").concat(specifier);
    } // origin relative


    if (specifier[0] === "/") {
      return "".concat(hrefToOrigin(baseUrl)).concat(specifier);
    }

    var baseOrigin = hrefToOrigin(baseUrl);
    var basePathname = hrefToPathname(baseUrl); // pathname relative inside

    if (specifier.slice(0, 2) === "./") {
      var baseDirname = pathnameToDirname(basePathname);
      return "".concat(baseOrigin).concat(baseDirname, "/").concat(specifier.slice(2));
    } // pathname relative outside


    if (specifier.slice(0, 3) === "../") {
      var unresolvedPathname = specifier;
      var importerFolders = basePathname.split("/");
      importerFolders.pop();

      while (unresolvedPathname.slice(0, 3) === "../") {
        // when there is no folder left to resolved
        // we just ignore '../'
        if (importerFolders.length) {
          importerFolders.pop();
        }

        unresolvedPathname = unresolvedPathname.slice(3);
      }

      var resolvedPathname = "".concat(importerFolders.join("/"), "/").concat(unresolvedPathname);
      return "".concat(baseOrigin).concat(resolvedPathname);
    } // bare


    if (basePathname === "") {
      return "".concat(baseOrigin, "/").concat(specifier);
    }

    if (basePathname[basePathname.length] === "/") {
      return "".concat(baseOrigin).concat(basePathname).concat(specifier);
    }

    return "".concat(baseOrigin).concat(pathnameToDirname(basePathname), "/").concat(specifier);
  };

  var writeBaseUrlMustBeAString = function writeBaseUrlMustBeAString(_ref) {
    var baseUrl = _ref.baseUrl,
        specifier = _ref.specifier;
    return "baseUrl must be a string.\n--- base url ---\n".concat(baseUrl, "\n--- specifier ---\n").concat(specifier);
  };

  var writeBaseUrlMustBeAbsolute = function writeBaseUrlMustBeAbsolute(_ref2) {
    var baseUrl = _ref2.baseUrl,
        specifier = _ref2.specifier;
    return "baseUrl must be absolute.\n--- base url ---\n".concat(baseUrl, "\n--- specifier ---\n").concat(specifier);
  };

  var writeBaseUrlRequired = function writeBaseUrlRequired(_ref3) {
    var baseUrl = _ref3.baseUrl,
        specifier = _ref3.specifier;
    return "baseUrl required to resolve relative specifier.\n--- base url ---\n".concat(baseUrl, "\n--- specifier ---\n").concat(specifier);
  };

  var tryUrlResolution = function tryUrlResolution(string, url) {
    var result = resolveUrl(string, url);
    return hasScheme(result) ? result : null;
  };

  var resolveSpecifier = function resolveSpecifier(specifier, importer) {
    if (specifier[0] === "/" || specifier.startsWith("./") || specifier.startsWith("../")) {
      return resolveUrl(specifier, importer);
    }

    if (hasScheme(specifier)) {
      return specifier;
    }

    return null;
  };

  var sortImports = function sortImports(imports) {
    var importsSorted = {};
    Object.keys(imports).sort(compareLengthOrLocaleCompare).forEach(function (name) {
      importsSorted[name] = imports[name];
    });
    return importsSorted;
  };
  var sortScopes = function sortScopes(scopes) {
    var scopesSorted = {};
    Object.keys(scopes).sort(compareLengthOrLocaleCompare).forEach(function (scopeName) {
      scopesSorted[scopeName] = sortImports(scopes[scopeName]);
    });
    return scopesSorted;
  };

  var compareLengthOrLocaleCompare = function compareLengthOrLocaleCompare(a, b) {
    return b.length - a.length || a.localeCompare(b);
  };

  var normalizeImportMap = function normalizeImportMap(importMap, baseUrl) {
    assertImportMap(importMap);

    if (typeof baseUrl !== "string") {
      throw new TypeError(formulateBaseUrlMustBeAString({
        baseUrl: baseUrl
      }));
    }

    var imports = importMap.imports,
        scopes = importMap.scopes;
    return {
      imports: imports ? normalizeImports(imports, baseUrl) : undefined,
      scopes: scopes ? normalizeScopes(scopes, baseUrl) : undefined
    };
  };

  var normalizeImports = function normalizeImports(imports, baseUrl) {
    var importsNormalized = {};
    Object.keys(imports).forEach(function (specifier) {
      var address = imports[specifier];

      if (typeof address !== "string") {
        console.warn(formulateAddressMustBeAString({
          address: address,
          specifier: specifier
        }));
        return;
      }

      var specifierResolved = resolveSpecifier(specifier, baseUrl) || specifier;
      var addressUrl = tryUrlResolution(address, baseUrl);

      if (addressUrl === null) {
        console.warn(formulateAdressResolutionFailed({
          address: address,
          baseUrl: baseUrl,
          specifier: specifier
        }));
        return;
      }

      if (specifier.endsWith("/") && !addressUrl.endsWith("/")) {
        console.warn(formulateAddressUrlRequiresTrailingSlash({
          addressUrl: addressUrl,
          address: address,
          specifier: specifier
        }));
        return;
      }

      importsNormalized[specifierResolved] = addressUrl;
    });
    return sortImports(importsNormalized);
  };

  var normalizeScopes = function normalizeScopes(scopes, baseUrl) {
    var scopesNormalized = {};
    Object.keys(scopes).forEach(function (scope) {
      var scopeValue = scopes[scope];
      var scopeUrl = tryUrlResolution(scope, baseUrl);

      if (scopeUrl === null) {
        console.warn(formulateScopeResolutionFailed({
          scope: scope,
          baseUrl: baseUrl
        }));
        return;
      }

      var scopeValueNormalized = normalizeImports(scopeValue, baseUrl);
      scopesNormalized[scopeUrl] = scopeValueNormalized;
    });
    return sortScopes(scopesNormalized);
  };

  var formulateBaseUrlMustBeAString = function formulateBaseUrlMustBeAString(_ref) {
    var baseUrl = _ref.baseUrl;
    return "baseUrl must be a string.\n--- base url ---\n".concat(baseUrl);
  };

  var formulateAddressMustBeAString = function formulateAddressMustBeAString(_ref2) {
    var specifier = _ref2.specifier,
        address = _ref2.address;
    return "Address must be a string.\n--- address ---\n".concat(address, "\n--- specifier ---\n").concat(specifier);
  };

  var formulateAdressResolutionFailed = function formulateAdressResolutionFailed(_ref3) {
    var address = _ref3.address,
        baseUrl = _ref3.baseUrl,
        specifier = _ref3.specifier;
    return "Address url resolution failed.\n--- address ---\n".concat(address, "\n--- base url ---\n").concat(baseUrl, "\n--- specifier ---\n").concat(specifier);
  };

  var formulateAddressUrlRequiresTrailingSlash = function formulateAddressUrlRequiresTrailingSlash(_ref4) {
    var addressURL = _ref4.addressURL,
        address = _ref4.address,
        specifier = _ref4.specifier;
    return "Address must end with /.\n--- address url ---\n".concat(addressURL, "\n--- address ---\n").concat(address, "\n--- specifier ---\n").concat(specifier);
  };

  var formulateScopeResolutionFailed = function formulateScopeResolutionFailed(_ref5) {
    var scope = _ref5.scope,
        baseUrl = _ref5.baseUrl;
    return "Scope url resolution failed.\n--- scope ---\n".concat(scope, "\n--- base url ---\n").concat(baseUrl);
  };

  var pathnameToExtension = function pathnameToExtension(pathname) {
    var slashLastIndex = pathname.lastIndexOf("/");

    if (slashLastIndex !== -1) {
      pathname = pathname.slice(slashLastIndex + 1);
    }

    var dotLastIndex = pathname.lastIndexOf(".");
    if (dotLastIndex === -1) return ""; // if (dotLastIndex === pathname.length - 1) return ""

    return pathname.slice(dotLastIndex);
  };

  var applyImportMap = function applyImportMap(_ref) {
    var importMap = _ref.importMap,
        specifier = _ref.specifier,
        importer = _ref.importer;
    assertImportMap(importMap);

    if (typeof specifier !== "string") {
      throw new TypeError(writeSpecifierMustBeAString({
        specifier: specifier,
        importer: importer
      }));
    }

    if (importer) {
      if (typeof importer !== "string") {
        throw new TypeError(writeImporterMustBeAString({
          importer: importer,
          specifier: specifier
        }));
      }

      if (!hasScheme(importer)) {
        throw new Error(writeImporterMustBeAbsolute({
          importer: importer,
          specifier: specifier
        }));
      }
    }

    var specifierUrl = resolveSpecifier(specifier, importer);
    var specifierNormalized = specifierUrl || specifier;
    var scopes = importMap.scopes;

    if (scopes && importer) {
      var scopeKeyMatching = Object.keys(scopes).find(function (scopeKey) {
        return scopeKey === importer || specifierIsPrefixOf(scopeKey, importer);
      });

      if (scopeKeyMatching) {
        var scopeValue = scopes[scopeKeyMatching];
        var remappingFromScopeImports = applyImports(specifierNormalized, scopeValue);

        if (remappingFromScopeImports !== null) {
          return remappingFromScopeImports;
        }
      }
    }

    var imports = importMap.imports;

    if (imports) {
      var remappingFromImports = applyImports(specifierNormalized, imports);

      if (remappingFromImports !== null) {
        return remappingFromImports;
      }
    }

    if (specifierUrl) {
      return specifierUrl;
    }

    throw new Error(writeBareSpecifierMustBeRemapped({
      specifier: specifier,
      importer: importer
    }));
  };

  var applyImports = function applyImports(specifier, imports) {
    var importKeyArray = Object.keys(imports);
    var i = 0;

    while (i < importKeyArray.length) {
      var importKey = importKeyArray[i];
      i++;

      if (importKey === specifier) {
        var importValue = imports[importKey];
        return importValue;
      }

      if (specifierIsPrefixOf(importKey, specifier)) {
        var _importValue = imports[importKey];
        var afterImportKey = specifier.slice(importKey.length);
        return tryUrlResolution(afterImportKey, _importValue);
      }
    }

    return null;
  };

  var specifierIsPrefixOf = function specifierIsPrefixOf(specifierHref, href) {
    return specifierHref[specifierHref.length - 1] === "/" && href.startsWith(specifierHref);
  };

  var writeSpecifierMustBeAString = function writeSpecifierMustBeAString(_ref2) {
    var specifier = _ref2.specifier,
        importer = _ref2.importer;
    return "specifier must be a string.\n--- specifier ---\n".concat(specifier, "\n--- importer ---\n").concat(importer);
  };

  var writeImporterMustBeAString = function writeImporterMustBeAString(_ref3) {
    var importer = _ref3.importer,
        specifier = _ref3.specifier;
    return "importer must be a string.\n--- importer ---\n".concat(importer, "\n--- specifier ---\n").concat(specifier);
  };

  var writeImporterMustBeAbsolute = function writeImporterMustBeAbsolute(_ref4) {
    var importer = _ref4.importer,
        specifier = _ref4.specifier;
    return "importer must be an absolute url.\n--- importer ---\n".concat(importer, "\n--- specifier ---\n").concat(specifier);
  };

  var writeBareSpecifierMustBeRemapped = function writeBareSpecifierMustBeRemapped(_ref5) {
    var specifier = _ref5.specifier,
        importer = _ref5.importer;
    return "Unmapped bare specifier.\n--- specifier ---\n".concat(specifier, "\n--- importer ---\n").concat(importer);
  };

  // directly target the files because this code
  var resolveImport = function resolveImport(_ref) {
    var specifier = _ref.specifier,
        importer = _ref.importer,
        importMap = _ref.importMap,
        _ref$defaultExtension = _ref.defaultExtension,
        defaultExtension = _ref$defaultExtension === void 0 ? true : _ref$defaultExtension;
    return applyDefaultExtension({
      url: importMap ? applyImportMap({
        importMap: importMap,
        specifier: specifier,
        importer: importer
      }) : resolveUrl(specifier, importer),
      importer: importer,
      defaultExtension: defaultExtension
    });
  };

  var applyDefaultExtension = function applyDefaultExtension(_ref2) {
    var url = _ref2.url,
        importer = _ref2.importer,
        defaultExtension = _ref2.defaultExtension;

    if (typeof defaultExtension === "string") {
      var extension = pathnameToExtension(url);

      if (extension === "") {
        return "".concat(url).concat(defaultExtension);
      }

      return url;
    }

    if (defaultExtension === true) {
      var _extension = pathnameToExtension(url);

      if (_extension === "" && importer) {
        var importerPathname = hrefToPathname(importer);
        var importerExtension = pathnameToExtension(importerPathname);
        return "".concat(url).concat(importerExtension);
      }
    }

    return url;
  };

  var memoizeOnce = function memoizeOnce(compute) {
    var locked = false;
    var lockValue;

    var memoized = function memoized() {
      if (locked) return lockValue; // if compute is recursive wait for it to be fully done before storing the lockValue
      // so set locked later

      lockValue = compute.apply(void 0, arguments);
      locked = true;
      return lockValue;
    };

    memoized.deleteCache = function () {
      var value = lockValue;
      locked = false;
      lockValue = undefined;
      return value;
    };

    return memoized;
  };

  /*
  * SJS 6.1.4
  * Minimal SystemJS Build
  */
  (function () {
    var hasSelf = typeof self !== 'undefined';
    var hasDocument = typeof document !== 'undefined';
    var envGlobal = hasSelf ? self : global;
    var baseUrl;

    if (hasDocument) {
      var baseEl = document.querySelector('base[href]');
      if (baseEl) baseUrl = baseEl.href;
    }

    if (!baseUrl && typeof location !== 'undefined') {
      baseUrl = location.href.split('#')[0].split('?')[0];
      var lastSepIndex = baseUrl.lastIndexOf('/');
      if (lastSepIndex !== -1) baseUrl = baseUrl.slice(0, lastSepIndex + 1);
    }

    var backslashRegEx = /\\/g;

    function resolveIfNotPlainOrUrl(relUrl, parentUrl) {
      if (relUrl.indexOf('\\') !== -1) relUrl = relUrl.replace(backslashRegEx, '/'); // protocol-relative

      if (relUrl[0] === '/' && relUrl[1] === '/') {
        return parentUrl.slice(0, parentUrl.indexOf(':') + 1) + relUrl;
      } // relative-url
      else if (relUrl[0] === '.' && (relUrl[1] === '/' || relUrl[1] === '.' && (relUrl[2] === '/' || relUrl.length === 2 && (relUrl += '/')) || relUrl.length === 1 && (relUrl += '/')) || relUrl[0] === '/') {
          var parentProtocol = parentUrl.slice(0, parentUrl.indexOf(':') + 1); // Disabled, but these cases will give inconsistent results for deep backtracking
          //if (parentUrl[parentProtocol.length] !== '/')
          //  throw Error('Cannot resolve');
          // read pathname from parent URL
          // pathname taken to be part after leading "/"

          var pathname;

          if (parentUrl[parentProtocol.length + 1] === '/') {
            // resolving to a :// so we need to read out the auth and host
            if (parentProtocol !== 'file:') {
              pathname = parentUrl.slice(parentProtocol.length + 2);
              pathname = pathname.slice(pathname.indexOf('/') + 1);
            } else {
              pathname = parentUrl.slice(8);
            }
          } else {
            // resolving to :/ so pathname is the /... part
            pathname = parentUrl.slice(parentProtocol.length + (parentUrl[parentProtocol.length] === '/'));
          }

          if (relUrl[0] === '/') return parentUrl.slice(0, parentUrl.length - pathname.length - 1) + relUrl; // join together and split for removal of .. and . segments
          // looping the string instead of anything fancy for perf reasons
          // '../../../../../z' resolved to 'x/y' is just 'z'

          var segmented = pathname.slice(0, pathname.lastIndexOf('/') + 1) + relUrl;
          var output = [];
          var segmentIndex = -1;

          for (var i = 0; i < segmented.length; i++) {
            // busy reading a segment - only terminate on '/'
            if (segmentIndex !== -1) {
              if (segmented[i] === '/') {
                output.push(segmented.slice(segmentIndex, i + 1));
                segmentIndex = -1;
              }
            } // new segment - check if it is relative
            else if (segmented[i] === '.') {
                // ../ segment
                if (segmented[i + 1] === '.' && (segmented[i + 2] === '/' || i + 2 === segmented.length)) {
                  output.pop();
                  i += 2;
                } // ./ segment
                else if (segmented[i + 1] === '/' || i + 1 === segmented.length) {
                    i += 1;
                  } else {
                    // the start of a new segment as below
                    segmentIndex = i;
                  }
              } // it is the start of a new segment
              else {
                  segmentIndex = i;
                }
          } // finish reading out the last segment


          if (segmentIndex !== -1) output.push(segmented.slice(segmentIndex));
          return parentUrl.slice(0, parentUrl.length - pathname.length) + output.join('');
        }
    }
    /*
     * Import maps implementation
     *
     * To make lookups fast we pre-resolve the entire import map
     * and then match based on backtracked hash lookups
     *
     */


    function resolveUrl(relUrl, parentUrl) {
      return resolveIfNotPlainOrUrl(relUrl, parentUrl) || (relUrl.indexOf(':') !== -1 ? relUrl : resolveIfNotPlainOrUrl('./' + relUrl, parentUrl));
    }
    /*
     * SystemJS Core
     *
     * Provides
     * - System.import
     * - System.register support for
     *     live bindings, function hoisting through circular references,
     *     reexports, dynamic import, import.meta.url, top-level await
     * - System.getRegister to get the registration
     * - Symbol.toStringTag support in Module objects
     * - Hookable System.createContext to customize import.meta
     * - System.onload(err, id, deps) handler for tracing / hot-reloading
     *
     * Core comes with no System.prototype.resolve or
     * System.prototype.instantiate implementations
     */


    var hasSymbol = typeof Symbol !== 'undefined';
    var toStringTag = hasSymbol && Symbol.toStringTag;
    var REGISTRY = hasSymbol ? Symbol() : '@';

    function SystemJS() {
      this[REGISTRY] = {};
    }

    var systemJSPrototype = SystemJS.prototype;

    systemJSPrototype.prepareImport = function () {};

    systemJSPrototype.import = function (id, parentUrl) {
      var loader = this;
      return Promise.resolve(loader.prepareImport()).then(function () {
        return loader.resolve(id, parentUrl);
      }).then(function (id) {
        var load = getOrCreateLoad(loader, id);
        return load.C || topLevelLoad(loader, load);
      });
    }; // Hookable createContext function -> allowing eg custom import meta


    systemJSPrototype.createContext = function (parentId) {
      return {
        url: parentId
      };
    };

    var lastRegister;

    systemJSPrototype.register = function (deps, declare) {
      lastRegister = [deps, declare];
    };
    /*
     * getRegister provides the last anonymous System.register call
     */


    systemJSPrototype.getRegister = function () {
      var _lastRegister = lastRegister;
      lastRegister = undefined;
      return _lastRegister;
    };

    function getOrCreateLoad(loader, id, firstParentUrl) {
      var load = loader[REGISTRY][id];
      if (load) return load;
      var importerSetters = [];
      var ns = Object.create(null);
      if (toStringTag) Object.defineProperty(ns, toStringTag, {
        value: 'Module'
      });
      var instantiatePromise = Promise.resolve().then(function () {
        return loader.instantiate(id, firstParentUrl);
      }).then(function (registration) {
        if (!registration) throw Error('Module ' + id + ' did not instantiate');

        function _export(name, value) {
          // note if we have hoisted exports (including reexports)
          load.h = true;
          var changed = false;

          if (_typeof(name) !== 'object') {
            if (!(name in ns) || ns[name] !== value) {
              ns[name] = value;
              changed = true;
            }
          } else {
            for (var p in name) {
              var _value = name[p];

              if (!(p in ns) || ns[p] !== _value) {
                ns[p] = _value;
                changed = true;
              }
            }
          }

          if (changed) for (var i = 0; i < importerSetters.length; i++) {
            importerSetters[i](ns);
          }
          return value;
        }

        var declared = registration[1](_export, registration[1].length === 2 ? {
          import: function _import(importId) {
            return loader.import(importId, id);
          },
          meta: loader.createContext(id)
        } : undefined);

        load.e = declared.execute || function () {};

        return [registration[0], declared.setters || []];
      });
      var linkPromise = instantiatePromise.then(function (instantiation) {
        return Promise.all(instantiation[0].map(function (dep, i) {
          var setter = instantiation[1][i];
          return Promise.resolve(loader.resolve(dep, id)).then(function (depId) {
            var depLoad = getOrCreateLoad(loader, depId, id); // depLoad.I may be undefined for already-evaluated

            return Promise.resolve(depLoad.I).then(function () {
              if (setter) {
                depLoad.i.push(setter); // only run early setters when there are hoisted exports of that module
                // the timing works here as pending hoisted export calls will trigger through importerSetters

                if (depLoad.h || !depLoad.I) setter(depLoad.n);
              }

              return depLoad;
            });
          });
        })).then(function (depLoads) {
          load.d = depLoads;
        });
      });
      linkPromise.catch(function (err) {
        load.e = null;
        load.er = err;
      }); // Capital letter = a promise function

      return load = loader[REGISTRY][id] = {
        id: id,
        // importerSetters, the setters functions registered to this dependency
        // we retain this to add more later
        i: importerSetters,
        // module namespace object
        n: ns,
        // instantiate
        I: instantiatePromise,
        // link
        L: linkPromise,
        // whether it has hoisted exports
        h: false,
        // On instantiate completion we have populated:
        // dependency load records
        d: undefined,
        // execution function
        // set to NULL immediately after execution (or on any failure) to indicate execution has happened
        // in such a case, pC should be used, and pLo, pLi will be emptied
        e: undefined,
        // On execution we have populated:
        // the execution error if any
        er: undefined,
        // in the case of TLA, the execution promise
        E: undefined,
        // On execution, pLi, pLo, e cleared
        // Promise for top-level completion
        C: undefined
      };
    }

    function instantiateAll(loader, load, loaded) {
      if (!loaded[load.id]) {
        loaded[load.id] = true; // load.L may be undefined for already-instantiated

        return Promise.resolve(load.L).then(function () {
          return Promise.all(load.d.map(function (dep) {
            return instantiateAll(loader, dep, loaded);
          }));
        });
      }
    }

    function topLevelLoad(loader, load) {
      return load.C = instantiateAll(loader, load, {}).then(function () {
        return postOrderExec(loader, load, {});
      }).then(function () {
        return load.n;
      });
    } // the closest we can get to call(undefined)


    var nullContext = Object.freeze(Object.create(null)); // returns a promise if and only if a top-level await subgraph
    // throws on sync errors

    function postOrderExec(loader, load, seen) {
      if (seen[load.id]) return;
      seen[load.id] = true;

      if (!load.e) {
        if (load.er) throw load.er;
        if (load.E) return load.E;
        return;
      } // deps execute first, unless circular


      var depLoadPromises;
      load.d.forEach(function (depLoad) {
        {
          var depLoadPromise = postOrderExec(loader, depLoad, seen);
          if (depLoadPromise) (depLoadPromises = depLoadPromises || []).push(depLoadPromise);
        }
      });
      if (depLoadPromises) return Promise.all(depLoadPromises).then(doExec);
      return doExec();

      function doExec() {
        try {
          var execPromise = load.e.call(nullContext);

          if (execPromise) {
            execPromise = execPromise.then(function () {
              load.C = load.n;
              load.E = null;
            });
            return load.E = load.E || execPromise;
          } // (should be a promise, but a minify optimization to leave out Promise.resolve)


          load.C = load.n;
        } catch (err) {
          load.er = err;
          throw err;
        } finally {
          load.L = load.I = undefined;
          load.e = null;
        }
      }
    }

    envGlobal.System = new SystemJS();
    /*
     * Supports loading System.register via script tag injection
     */

    var systemRegister = systemJSPrototype.register;

    systemJSPrototype.register = function (deps, declare) {
      systemRegister.call(this, deps, declare);
    };

    systemJSPrototype.instantiate = function (url, firstParentUrl) {
      var loader = this;
      return new Promise(function (resolve, reject) {
        var err;

        function windowErrorListener(evt) {
          if (evt.filename === url) err = evt.error;
        }

        window.addEventListener('error', windowErrorListener);
        var script = document.createElement('script');
        script.charset = 'utf-8';
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.addEventListener('error', function () {
          window.removeEventListener('error', windowErrorListener);
          reject(Error('Error loading ' + url + (firstParentUrl ? ' from ' + firstParentUrl : '')));
        });
        script.addEventListener('load', function () {
          window.removeEventListener('error', windowErrorListener);
          document.head.removeChild(script); // Note that if an error occurs that isn't caught by this if statement,
          // that getRegister will return null and a "did not instantiate" error will be thrown.

          if (err) {
            reject(err);
          } else {
            resolve(loader.getRegister());
          }
        });
        script.src = url;
        document.head.appendChild(script);
      });
    };

    if (hasDocument) {
      window.addEventListener('DOMContentLoaded', loadScriptModules);
      loadScriptModules();
    }

    function loadScriptModules() {
      Array.prototype.forEach.call(document.querySelectorAll('script[type=systemjs-module]'), function (script) {
        if (script.src) {
          System.import(script.src.slice(0, 7) === 'import:' ? script.src.slice(7) : resolveUrl(script.src, baseUrl));
        }
      });
    }
    /*
     * Supports loading System.register in workers
     */


    if (hasSelf && typeof importScripts === 'function') systemJSPrototype.instantiate = function (url) {
      var loader = this;
      return new Promise(function (resolve, reject) {
        try {
          importScripts(url);
        } catch (e) {
          reject(e);
        }

        resolve(loader.getRegister());
      });
    };

    systemJSPrototype.resolve = function (id, parentUrl) {
      var resolved = resolveIfNotPlainOrUrl(id, parentUrl || baseUrl);

      if (!resolved) {
        if (id.indexOf(':') !== -1) return Promise.resolve(id);
        throw Error('Cannot resolve "' + id + (parentUrl ? '" from ' + parentUrl : '"'));
      }

      return Promise.resolve(resolved);
    };
  })();

  var valueInstall = function valueInstall(object, name, value) {
    var has = name in object;
    var previous = object[name];
    object[name] = value;
    return function () {
      if (has) {
        object[name] = previous;
      } else {
        delete object[name];
      }
    };
  };

  var objectWithoutPropertiesLoose = (function (source, excluded) {
    if (source === null) return {};
    var target = {};
    var sourceKeys = Object.keys(source);
    var key;
    var i;

    for (i = 0; i < sourceKeys.length; i++) {
      key = sourceKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      target[key] = source[key];
    }

    return target;
  });

  var _objectWithoutProperties = (function (source, excluded) {
    if (source === null) return {};
    var target = objectWithoutPropertiesLoose(source, excluded);
    var key;
    var i;

    if (Object.getOwnPropertySymbols) {
      var sourceSymbolKeys = Object.getOwnPropertySymbols(source);

      for (i = 0; i < sourceSymbolKeys.length; i++) {
        key = sourceSymbolKeys[i];
        if (excluded.indexOf(key) >= 0) continue;
        if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
        target[key] = source[key];
      }
    }

    return target;
  });

  var createError = function createError(_ref) {
    var message = _ref.message,
        rest = _objectWithoutProperties(_ref, ["message"]);

    var error = new Error(message);
    defineNonEnumerableProperties(error, rest);
    return error;
  };

  var defineNonEnumerableProperties = function defineNonEnumerableProperties(object, properties) {
    Object.keys(properties).forEach(function (name) {
      Object.defineProperty(object, name, {
        value: properties[name],
        enumerable: false
      });
    });
  };

  var createModuleNotFoundError = function createModuleNotFoundError(_ref) {
    var href = _ref.href,
        importerHref = _ref.importerHref;
    return importerHref ? createImportedModuleNotFoundError({
      href: href,
      importerHref: importerHref
    }) : createMainModuleNotFoundError({
      href: href
    });
  };

  var createImportedModuleNotFoundError = function createImportedModuleNotFoundError(_ref2) {
    var href = _ref2.href,
        importerHref = _ref2.importerHref;
    return createError({
      code: "MODULE_NOT_FOUND_ERROR",
      message: "imported module not found.\nhref: ".concat(href, "\nimporter href: ").concat(importerHref),
      href: href,
      importerHref: importerHref
    });
  };

  var createMainModuleNotFoundError = function createMainModuleNotFoundError(_ref3) {
    var href = _ref3.href;
    return createError({
      code: "MODULE_NOT_FOUND_ERROR",
      message: "main module not found.\nhref: ".concat(href),
      href: href
    });
  };

  var createModuleParsingError = function createModuleParsingError(_ref) {
    var href = _ref.href,
        parsingError = _ref.parsingError,
        importerHref = _ref.importerHref;
    return importerHref ? createImportedModuleParsingError({
      href: href,
      parsingError: parsingError,
      importerHref: importerHref
    }) : createMainModuleParsingError({
      href: href,
      parsingError: parsingError
    });
  };

  var createImportedModuleParsingError = function createImportedModuleParsingError(_ref2) {
    var href = _ref2.href,
        parsingError = _ref2.parsingError,
        importerHref = _ref2.importerHref;
    return createError({
      code: "MODULE_PARSING_ERROR",
      message: "imported module parsing error.\nhref: ".concat(href, "\nimporter href: ").concat(importerHref, "\nparsing error message: ").concat(parsingError.message),
      href: href,
      parsingError: parsingError,
      importerHref: importerHref
    });
  };

  var createMainModuleParsingError = function createMainModuleParsingError(_ref3) {
    var href = _ref3.href,
        parsingError = _ref3.parsingError;
    return createError({
      code: "MODULE_PARSING_ERROR",
      message: "main module parsing error.\nhref: ".concat(href, "\nparsing error message: ").concat(parsingError.message),
      href: href,
      parsingError: parsingError
    });
  };

  var createModuleResponseUnsupportedStatusError = function createModuleResponseUnsupportedStatusError(_ref) {
    var href = _ref.href,
        status = _ref.status,
        statusText = _ref.statusText,
        importerHref = _ref.importerHref;
    return importerHref ? createImportedModuleResponseUnsupportedContentTypeHeaderError({
      href: href,
      status: status,
      statusText: statusText,
      importerHref: importerHref
    }) : createMainModuleResponseUnsupportedContentTypeHeaderError({
      href: href,
      status: status,
      statusText: statusText
    });
  };

  var createImportedModuleResponseUnsupportedContentTypeHeaderError = function createImportedModuleResponseUnsupportedContentTypeHeaderError(_ref2) {
    var href = _ref2.href,
        status = _ref2.status,
        statusText = _ref2.statusText,
        importerHref = _ref2.importerHref;
    return createError({
      code: "MODULE_RESPONSE_UNSUPPORTED_STATUS",
      message: "imported module response unsupported status.\nhref: ".concat(href, "\nimporterHref: ").concat(importerHref, "\nstatus: ").concat(status, "\nstatusText: ").concat(statusText),
      href: href,
      status: status,
      statusText: statusText,
      importerHref: importerHref
    });
  };

  var createMainModuleResponseUnsupportedContentTypeHeaderError = function createMainModuleResponseUnsupportedContentTypeHeaderError(_ref3) {
    var href = _ref3.href,
        status = _ref3.status,
        statusText = _ref3.statusText;
    return createError({
      code: "MODULE_RESPONSE_UNSUPPORTED_STATUS",
      message: "main module response unsupported status.\nhref: ".concat(href, "\nstatus: ").concat(status, "\nstatusText: ").concat(statusText),
      href: href,
      status: status,
      statusText: statusText
    });
  };

  var createModuleInstantiationError = function createModuleInstantiationError(_ref) {
    var href = _ref.href,
        instantiationError = _ref.instantiationError,
        importerHref = _ref.importerHref;
    return importerHref ? createImportedModuleInstantiationError({
      href: href,
      instantiationError: instantiationError,
      importerHref: importerHref
    }) : createMainModuleInstantiationErrorMessage({
      href: href,
      instantiationError: instantiationError
    });
  };

  var createImportedModuleInstantiationError = function createImportedModuleInstantiationError(_ref2) {
    var href = _ref2.href,
        instantiationError = _ref2.instantiationError,
        importerHref = _ref2.importerHref;
    return createError({
      code: "MODULE_INSTANTIATION_ERROR",
      message: "imported module instantiation error.\nhref: ".concat(href, "\nimporter href: ").concat(importerHref, "\ninstantiation error message: ").concat(instantiationError.message),
      href: href,
      instantiationError: instantiationError,
      importerHref: importerHref
    });
  };

  var createMainModuleInstantiationErrorMessage = function createMainModuleInstantiationErrorMessage(_ref3) {
    var href = _ref3.href,
        instantiationError = _ref3.instantiationError;
    return createError({
      code: "MODULE_INSTANTIATION_ERROR",
      message: "main module instantiation error.\nhref: ".concat(href, "\ninstantiation error message: ").concat(instantiationError.message),
      href: href,
      instantiationError: instantiationError
    });
  };

  var fromFunctionReturningRegisteredModule = function fromFunctionReturningRegisteredModule(fn, _ref) {
    var href = _ref.href,
        importerHref = _ref.importerHref;

    try {
      return fn();
    } catch (error) {
      throw createModuleInstantiationError({
        href: href,
        instantiationError: error,
        importerHref: importerHref
      });
    }
  };

  var fromFunctionReturningNamespace = function fromFunctionReturningNamespace(fn, _ref) {
    var href = _ref.href,
        importerHref = _ref.importerHref;
    return fromFunctionReturningRegisteredModule(function () {
      // should we compute the namespace here
      // or as it is done below, defer to execute ?
      // I think defer to execute is better
      return [[], function (_export) {
        return {
          execute: function execute() {
            var namespace = fn();

            _export(namespace);
          }
        };
      }];
    }, {
      href: href,
      importerHref: importerHref
    });
  };

  var spellMissingContentTypeForModule = function spellMissingContentTypeForModule(_ref) {
    var href = _ref.href,
        importerHref = _ref.importerHref;
    return "Module handled as text because of missing content-type.\n--- href ---\n".concat(href, "\n--- importer href ---\n").concat(importerHref);
  };
  var spellUnexpectedContentTypeForModule = function spellUnexpectedContentTypeForModule(_ref2) {
    var contentType = _ref2.contentType,
        href = _ref2.href,
        importerHref = _ref2.importerHref;
    return "Module handled as text because of unexpected content-type.\n--- content-type ---\n".concat(contentType, "\n--- href ---\n").concat(href, "\n--- importer href ---\n").concat(importerHref);
  };

  function _await(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  function _async(f) {
    return function () {
      for (var args = [], i = 0; i < arguments.length; i++) {
        args[i] = arguments[i];
      }

      try {
        return Promise.resolve(f.apply(this, args));
      } catch (e) {
        return Promise.reject(e);
      }
    };
  }

  var fromHref = _async(function (_ref) {
    var href = _ref.href,
        importerHref = _ref.importerHref,
        executionId = _ref.executionId,
        fetchSource = _ref.fetchSource,
        instantiateJavaScript = _ref.instantiateJavaScript;
    return _await(fetchSource({
      href: href,
      importerHref: importerHref,
      executionId: executionId
    }), function (_ref2) {
      var url = _ref2.url,
          status = _ref2.status,
          statusText = _ref2.statusText,
          headers = _ref2.headers,
          body = _ref2.body;
      var realHref = url;

      if (status === 404) {
        throw createModuleNotFoundError({
          href: realHref,
          importerHref: importerHref
        });
      }

      if (status === 500 && statusText === "parse error") {
        throw createModuleParsingError({
          href: realHref,
          parsingError: JSON.parse(body),
          importerHref: importerHref
        });
      }

      if (status < 200 || status >= 300) {
        throw createModuleResponseUnsupportedStatusError({
          href: realHref,
          status: status,
          statusText: statusText,
          importerHref: importerHref
        });
      }

      var asText = fromFunctionReturningNamespace(function () {
        return {
          default: JSON.stringify(body)
        };
      }, {
        href: realHref,
        importerHref: importerHref
      });

      if ("content-type" in headers === false) {
        console.warn(spellMissingContentTypeForModule({
          href: realHref,
          importerHref: importerHref
        }));
        return asText;
      }

      var contentType = headers["content-type"];

      if (contentType === "application/javascript") {
        return fromFunctionReturningRegisteredModule(function () {
          return instantiateJavaScript(body, realHref);
        }, {
          href: realHref,
          importerHref: importerHref
        });
      }

      if (contentType === "application/json") {
        return fromFunctionReturningNamespace(function () {
          return {
            default: JSON.parse(body)
          };
        }, {
          href: realHref,
          importerHref: importerHref
        });
      }

      if (!contentType.startsWith("text/")) {
        console.warn(spellUnexpectedContentTypeForModule({
          contentType: contentType,
          href: realHref,
          importerHref: importerHref
        }));
      }

      return asText;
    });
  });

  var defineProperty = (function (obj, key, value) {
    // Shortcircuit the slow defineProperty path when possible.
    // We are trying to avoid issues where setters defined on the
    // prototype cause side effects under the fast path of simple
    // assignment. By checking for existence of the property with
    // the in operator, we can optimize most of this overhead away.
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  });

  function _objectSpread (target) {
    for (var i = 1; i < arguments.length; i++) {
      // eslint-disable-next-line prefer-rest-params
      var source = arguments[i] === null ? {} : arguments[i];

      if (i % 2) {
        // eslint-disable-next-line no-loop-func
        ownKeys(source, true).forEach(function (key) {
          defineProperty(target, key, source[key]);
        });
      } else if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
      } else {
        // eslint-disable-next-line no-loop-func
        ownKeys(source).forEach(function (key) {
          Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
      }
    }

    return target;
  } // This function is different to "Reflect.ownKeys". The enumerableOnly
  // filters on symbol properties only. Returned string properties are always
  // enumerable. It is good to use in objectSpread.

  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);

    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);
      if (enumerableOnly) symbols = symbols.filter(function (sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      }); // eslint-disable-next-line prefer-spread

      keys.push.apply(keys, symbols);
    }

    return keys;
  }

  var fetchUsingXHR = function fetchUsingXHR(url, _ref) {
    var _ref$credentials = _ref.credentials,
        credentials = _ref$credentials === void 0 ? "same-origin" : _ref$credentials,
        _ref$headers = _ref.headers,
        headers = _ref$headers === void 0 ? {} : _ref$headers;
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();

      var cleanup = function cleanup() {
        xhr.ontimeout = null;
        xhr.onerror = null;
        xhr.onload = null;
        xhr.onreadystatechange = null;
      };

      xhr.ontimeout = function () {
        cleanup();
        reject(createRequestTimeoutError({
          url: url
        }));
      };

      xhr.onerror = function (error) {
        cleanup();

        if (typeof window.ProgressEvent === "function" && error instanceof ProgressEvent) {
          // unfortunately with have no clue why it fails
          // might be cors for instance
          reject(createRequestError({
            url: url
          }));
        } else {
          reject(error);
        }
      };

      xhr.onload = function () {
        cleanup();

        if (xhr.status === 0) {
          resolve(_objectSpread({}, normalizeXhr(xhr), {
            status: 200
          }));
        } else {
          resolve(normalizeXhr(xhr));
        }
      };

      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) {
          return;
        } // in Chrome on file:/// URLs, status is 0


        if (xhr.status === 0) {
          if (xhr.responseText) {
            xhr.onload();
          }

          return;
        }

        cleanup();
        resolve(normalizeXhr(xhr));
      };

      xhr.open("GET", url, true);
      Object.keys(headers).forEach(function (key) {
        xhr.setRequestHeader(key, headers[key]);
      });
      xhr.withCredentials = computeWithCredentials({
        credentials: credentials,
        url: url
      });
      xhr.send(null);
    });
  }; // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch

  var computeWithCredentials = function computeWithCredentials(_ref2) {
    var credentials = _ref2.credentials,
        url = _ref2.url;

    if (credentials === "same-origin") {
      return originSameAsGlobalOrigin(url);
    }

    return credentials === "include";
  };

  var originSameAsGlobalOrigin = function originSameAsGlobalOrigin(url) {
    // if we cannot read globalOrigin from window.location.origin, let's consider it's ok
    if ((typeof window === "undefined" ? "undefined" : _typeof(window)) !== "object") return true;
    if (_typeof(window.location) !== "object") return true;
    var globalOrigin = window.location.origin;
    if (globalOrigin === "null") return true;
    return hrefToOrigin(url) === globalOrigin;
  };

  var createRequestError = function createRequestError(_ref3) {
    var url = _ref3.url;
    var error = new Error("request error.\nurl: ".concat(url));
    error.code = "REQUEST_ERROR";
    return error;
  };

  var createRequestTimeoutError = function createRequestTimeoutError(_ref4) {
    var url = _ref4.url;
    var error = new Error("request timeout.\nurl: ".concat(url));
    error.code = "REQUEST_TIMEOUT";
    return error;
  };

  var normalizeXhr = function normalizeXhr(xhr) {
    return {
      // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/responseURL
      url: xhr.responseURL,
      status: xhr.status,
      statusText: xhr.statusText,
      headers: getHeadersFromXHR(xhr),
      body: xhr.responseText
    };
  }; // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/getAllResponseHeaders#Example


  var getHeadersFromXHR = function getHeadersFromXHR(xhr) {
    var headerMap = {};
    var headersString = xhr.getAllResponseHeaders();
    if (headersString === "") return headerMap;
    var lines = headersString.trim().split(/[\r\n]+/);
    lines.forEach(function (line) {
      var parts = line.split(": ");
      var name = parts.shift();
      var value = parts.join(": ");
      headerMap[name.toLowerCase()] = value;
    });
    return headerMap;
  };

  var fetchSource = function fetchSource(_ref) {
    var href = _ref.href,
        executionId = _ref.executionId;
    return fetchUsingXHR(href, {
      credentials: "include",
      headers: _objectSpread({}, executionId ? {
        "x-jsenv-execution-id": executionId
      } : {})
    });
  };

  // eslint-disable-next-line no-eval
  var evalSource = function evalSource(code, href) {
    return window.eval(appendSourceURL(code, href));
  };

  var appendSourceURL = function appendSourceURL(code, sourceURL) {
    return "".concat(code, "\n", "//#", " sourceURL=").concat(sourceURL);
  };

  function _async$1(f) {
    return function () {
      for (var args = [], i = 0; i < arguments.length; i++) {
        args[i] = arguments[i];
      }

      try {
        return Promise.resolve(f.apply(this, args));
      } catch (e) {
        return Promise.reject(e);
      }
    };
  }

  var GLOBAL_SPECIFIER = "global";
  var createBrowserSystem = _async$1(function (_ref) {
    var resolveImport = _ref.resolveImport,
        executionId = _ref.executionId;

    if (typeof window.System === "undefined") {
      throw new Error("window.System is undefined");
    }

    var browserSystem = new window.System.constructor();

    browserSystem.resolve = function (specifier, importer) {
      return resolveImport(specifier, importer);
    };

    browserSystem.instantiate = function (href, importerHref) {
      if (href === GLOBAL_SPECIFIER) {
        return fromFunctionReturningNamespace(function () {
          return window;
        }, {
          href: href,
          importerHref: importerHref
        });
      }
      return fromHref({
        href: href,
        importerHref: importerHref,
        fetchSource: fetchSource,
        instantiateJavaScript: function instantiateJavaScript(source, realHref) {
          var uninstallSystemGlobal = valueInstall(window, "System", browserSystem);

          try {
            evalSource(source, realHref);
          } finally {
            uninstallSystemGlobal();
          }

          return browserSystem.getRegister();
        },
        executionId: executionId
      });
    };

    browserSystem.createContext = function (importerUrl) {
      return {
        url: importerUrl,
        resolve: function resolve(specifier) {
          return resolveImport(specifier, importerUrl);
        }
      };
    };

    return browserSystem;
  });

  // `Error: yo
  // at Object.execute (http://127.0.0.1:57300/build/src/__test__/file-throw.js:9:13)
  // at doExec (http://127.0.0.1:3000/src/__test__/file-throw.js:452:38)
  // at postOrderExec (http://127.0.0.1:3000/src/__test__/file-throw.js:448:16)
  // at http://127.0.0.1:3000/src/__test__/file-throw.js:399:18`.replace(/(?:https?|ftp|file):\/\/(.*+)$/gm, (...args) => {
  //   debugger
  // })
  var stringToStringWithLink = function stringToStringWithLink(source) {
    var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref$transform = _ref.transform,
        transform = _ref$transform === void 0 ? function (href) {
      return {
        href: href,
        text: href
      };
    } : _ref$transform;

    return source.replace(/(?:https?|ftp|file):\/\/\S+/gm, function (match) {
      var linkHTML = "";
      var lastChar = match[match.length - 1]; // hotfix because our url regex sucks a bit

      var endsWithSeparationChar = lastChar === ")" || lastChar === ":";

      if (endsWithSeparationChar) {
        match = match.slice(0, -1);
      }

      var lineAndColumnPattern = /:([0-9]+):([0-9]+)$/;
      var lineAndColumMatch = match.match(lineAndColumnPattern);

      if (lineAndColumMatch) {
        var lineAndColumnString = lineAndColumMatch[0];
        var lineNumber = lineAndColumMatch[1];
        var columnNumber = lineAndColumMatch[2];
        var url = match.slice(0, -lineAndColumnString.length);

        var _transform = transform(url),
            href = _transform.href,
            text = _transform.text;

        linkHTML = link({
          href: href,
          text: "".concat(text, ":").concat(lineNumber, ":").concat(columnNumber)
        });
      } else {
        var linePattern = /:([0-9]+)$/;
        var lineMatch = match.match(linePattern);

        if (lineMatch) {
          var lineString = lineMatch[0];
          var _lineNumber = lineMatch[1];

          var _url = match.slice(0, -lineString.length);

          var _transform2 = transform(_url),
              _href = _transform2.href,
              _text = _transform2.text;

          linkHTML = link({
            href: _href,
            text: "".concat(_text, ":").concat(_lineNumber)
          });
        } else {
          var _url2 = match;

          var _transform3 = transform(_url2),
              _href2 = _transform3.href,
              _text2 = _transform3.text;

          linkHTML = link({
            href: _href2,
            text: _text2
          });
        }
      }

      if (endsWithSeparationChar) {
        return "".concat(linkHTML).concat(lastChar);
      }

      return linkHTML;
    });
  };

  var link = function link(_ref2) {
    var href = _ref2.href,
        _ref2$text = _ref2.text,
        text = _ref2$text === void 0 ? href : _ref2$text;
    return "<a href=\"".concat(href, "\">").concat(text, "</a>");
  };

  var displayErrorInDocument = function displayErrorInDocument(error) {
    var title = "An error occured";
    var theme;
    var message;

    if (error && error.code === "MODULE_PARSING_ERROR") {
      theme = "light";
      var parsingError = error.parsingError;
      message = errorToHTML(parsingError.messageHTML || parsingError.message);
    } else {
      theme = "dark";
      message = errorToHTML(error);
    }

    var css = "\n    .jsenv-console pre {\n      overflow: auto;\n      /* avoid scrollbar to hide the text behind it */\n      padding-top: 20px;\n      padding-right: 20px;\n      padding-bottom: 20px;\n    }\n\n    .jsenv-console pre[data-theme=\"dark\"] {\n      background: transparent;\n      border: 1px solid black\n    }\n\n    .jsenv-console pre[data-theme=\"light\"] {\n      background: #1E1E1E;\n      border: 1px solid white;\n      color: #EEEEEE;\n    }\n\n    .jsenv-console pre[data-theme=\"light\"] a {\n      color: inherit;\n    }\n    "; // it could be a sort of dialog on top of document with
    // a slight opacity
    // or it should replace what is inside the document.
    // To know what to do we must test with some code having UI
    // and ensure error are still visible

    var html = "\n      <style type=\"text/css\">".concat(css, "></style>\n      <div class=\"jsenv-console\">\n        <h1>").concat(title, "</h1>\n        <pre data-theme=\"").concat(theme, "\">").concat(message, "</pre>\n      </div>\n      ");
    appendHMTLInside(html, document.body);
  };

  var errorToHTML = function errorToHTML(error) {
    var html;

    if (error && error instanceof Error) {
      html = error.stack;
    } else if (typeof error === "string") {
      html = error;
    } else {
      html = JSON.stringify(error);
    }

    var htmlWithCorrectLineBreaks = html.replace(/\n/g, "\n");
    var htmlWithLinks = stringToStringWithLink(htmlWithCorrectLineBreaks, {
      transform: function transform(href) {
        return {
          href: href,
          text: href
        };
      }
    });
    return htmlWithLinks;
  };

  var appendHMTLInside = function appendHMTLInside(html, parentNode) {
    var temoraryParent = document.createElement("div");
    temoraryParent.innerHTML = html;
    transferChildren(temoraryParent, parentNode);
  };

  var transferChildren = function transferChildren(fromNode, toNode) {
    while (fromNode.firstChild) {
      toNode.appendChild(fromNode.firstChild);
    }
  };

  function _await$1(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  var _window = window,
      Notification = _window.Notification;

  function _async$2(f) {
    return function () {
      for (var args = [], i = 0; i < arguments.length; i++) {
        args[i] = arguments[i];
      }

      try {
        return Promise.resolve(f.apply(this, args));
      } catch (e) {
        return Promise.reject(e);
      }
    };
  }

  var displayErrorNotificationNotAvailable = function displayErrorNotificationNotAvailable() {};

  var displayErrorNotificationImplementation = _async$2(function (error) {
    var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        icon = _ref.icon;

    return _await$1(Notification.requestPermission(), function (permission) {
      if (permission === "granted") {
        var notification = new Notification("An error occured", {
          lang: "en",
          body: error.stack,
          icon: icon
        });

        notification.onclick = function () {
          window.focus();
        };
      }
    });
  });

  var displayErrorNotification = typeof Notification === "function" ? displayErrorNotificationImplementation : displayErrorNotificationNotAvailable;

  /* eslint-disable import/max-dependencies */

  function _await$2(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  var GLOBAL_SPECIFIER$1 = "global";

  function _async$3(f) {
    return function () {
      for (var args = [], i = 0; i < arguments.length; i++) {
        args[i] = arguments[i];
      }

      try {
        return Promise.resolve(f.apply(this, args));
      } catch (e) {
        return Promise.reject(e);
      }
    };
  }

  var memoizedCreateBrowserSystem = memoizeOnce(createBrowserSystem);

  function _catch(body, recover) {
    try {
      var result = body();
    } catch (e) {
      return recover(e);
    }

    if (result && result.then) {
      return result.then(void 0, recover);
    }

    return result;
  }

  function _continue(value, then) {
    return value && value.then ? value.then(then) : then(value);
  }

  var createBrowserPlatform = function createBrowserPlatform(_ref) {
    var compileServerOrigin = _ref.compileServerOrigin;
    var compileId = computeCompileIdFromGroupId({
      groupId: resolveBrowserGroup({
        groupMap: groupMap
      }),
      groupMap: groupMap
    });

    var relativePathToCompiledHref = function relativePathToCompiledHref(relativePath) {
      return "".concat(compileServerOrigin).concat(compileIntoRelativePath, "/").concat(compileId).concat(relativePath);
    };

    var importMapNormalized = normalizeImportMap(importMap, "".concat(compileServerOrigin).concat(compileIntoRelativePath, "/").concat(compileId, "/"));

    var resolveImportScoped = function resolveImportScoped(specifier, importer) {
      if (specifier === GLOBAL_SPECIFIER$1) return specifier;
      return resolveImport({
        specifier: specifier,
        importer: importer,
        importMap: importMapNormalized,
        defaultExtension: importDefaultExtension
      });
    };

    var importFile = _async$3(function (specifier) {
      return _await$2(memoizedCreateBrowserSystem({
        compileServerOrigin: compileServerOrigin,
        compileIntoRelativePath: compileIntoRelativePath,
        resolveImport: resolveImportScoped
      }), function (browserSystem) {
        return browserSystem.import(specifier);
      });
    });

    var executeFile = _async$3(function (specifier) {
      var _ref2 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
          collectCoverage = _ref2.collectCoverage,
          collectNamespace = _ref2.collectNamespace,
          _ref2$errorExposureIn = _ref2.errorExposureInConsole,
          errorExposureInConsole = _ref2$errorExposureIn === void 0 ? true : _ref2$errorExposureIn,
          _ref2$errorExposureIn2 = _ref2.errorExposureInNotification,
          errorExposureInNotification = _ref2$errorExposureIn2 === void 0 ? false : _ref2$errorExposureIn2,
          _ref2$errorExposureIn3 = _ref2.errorExposureInDocument,
          errorExposureInDocument = _ref2$errorExposureIn3 === void 0 ? true : _ref2$errorExposureIn3,
          _ref2$errorTransform = _ref2.errorTransform,
          errorTransform = _ref2$errorTransform === void 0 ? function (error) {
        return error;
      } : _ref2$errorTransform,
          executionId = _ref2.executionId;

      return _await$2(memoizedCreateBrowserSystem({
        compileServerOrigin: compileServerOrigin,
        compileIntoRelativePath: compileIntoRelativePath,
        resolveImport: resolveImportScoped,
        executionId: executionId
      }), function (browserSystem) {
        return _catch(function () {
          return _await$2(browserSystem.import(specifier), function (namespace) {
            return {
              status: "completed",
              namespace: collectNamespace ? namespace : undefined,
              coverageMap: collectCoverage ? readCoverage() : undefined
            };
          });
        }, function (error) {
          var transformedError;
          return _continue(_catch(function () {
            return _await$2(errorTransform(error), function (_errorTransform) {
              transformedError = _errorTransform;
            });
          }, function () {
            transformedError = error;
          }), function () {
            if (errorExposureInConsole) displayErrorInConsole(transformedError);
            if (errorExposureInNotification) displayErrorNotification(transformedError);
            if (errorExposureInDocument) displayErrorInDocument(transformedError);
            return {
              status: "errored",
              exceptionSource: unevalException(transformedError),
              coverageMap: collectCoverage ? readCoverage() : undefined
            };
          });
        });
      });
    });

    return {
      relativePathToCompiledHref: relativePathToCompiledHref,
      resolveImportScoped: resolveImportScoped,
      importFile: importFile,
      executeFile: executeFile
    };
  };

  var unevalException = function unevalException(value) {
    return uneval(value);
  };

  var readCoverage = function readCoverage() {
    return window.__coverage__;
  };

  var displayErrorInConsole = function displayErrorInConsole(error) {
    console.error(error);
  };

  window.__browserPlatform__ = {
    create: createBrowserPlatform
  };

}());

//# sourceMappingURL=./browser-platform.js__asset__/browser-platform.js.map