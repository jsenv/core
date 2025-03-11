This template is a web project using preact pre-configured with jsenv.

You could just copy paste the files on your machine to start using it. There is also a command to do that:

```console
npx @jsenv/cli --web-preact
```

This template have scripts declared in [package.json#scripts](./package.json#L6):

- `npm run dev`: starts a server for source files; Documented in [B) Dev](../../../../docs/users/b_dev/b_dev.md).
- `npm run build`: generate build files; Documented in [C) Build](../../../../docs/users/c_build/c_build.md).
- `npm run build:serve`: start a server for build files; Documented in [C) Build#how-to-serve-build-files](../../../../docs/users/c_build/c_build.md#3-how-to-serve-build-files).
- `npm run test`: execute test files; Documented in [D) Test](../../../../docs/users/d_test/d_test.md).
