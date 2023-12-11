# 8.3.0

- Object composition in associated values

  **8.2.0**

  ```js
  import { URL_META } from "@jsenv/url-meta";

  const meta = URL_META.applyAssociations({
    url: "file:///file.js",
    associations: {
      node: {
        "file:///**/*.js": {
          foo: true,
        },
        "file:///file.js": {
          bar: true,
        },
      },
    },
  });
  console.log(meta); // { bar: true }
  ```

  **8.3.0**

  ```js
  import { URL_META } from "@jsenv/url-meta";

  const meta = URL_META.applyAssociations({
    url: "file:///file.js",
    associations: {
      node: {
        "file:///**/*.js": {
          foo: true,
        },
        "file:///file.js": {
          bar: true,
        },
      },
    },
  });
  console.log(meta); // { foo: true, bar: true }
  ```

# 8.1.0

- Fix pattern matching behaviour not working on some pattern involving `"**/"`

# 7.1.0

- Allow `null` in associations

  **7.0.2**

  ```js
  import { URL_META } from "@jsenv/url-meta";

  const meta = URL_META.applyAssociations({
    url: "file:///file.js",
    associations: { whatever: null }, // throw an error
  });
  console.log(meta);
  ```

  **7.1.0**

  ```js
  import { URL_META } from "@jsenv/url-meta";

  const meta = URL_META.applyAssociations({
    url: "file:///file.js",
    associations: { whatever: null },
  });
  console.log(meta); // {}
  ```
