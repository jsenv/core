# npm authentification on github registry

> Or how to be able to install node modules published on github registry

To add a dependency to a package hosted by github registry you will have to configure npm to get that package from github registry.<br />

For `jsenv` packages it means having the following line in your `.npmrc`<br />

```
@jsenv:registry=https://npm.pkg.github.com
```

But if you haven't configured npm authentification to the github registry, `npm install` would fail as shown in screenshot below.

![npm install authentification error screenshot](./npm-install-auth-error-screenshot.png)

To fix this error:

1. Create a token on github with `read:packages` scope.
2. Save your token with the following command
   ```console
   npm config set //npm.pkg.github.com/:_authToken personal-access-token
   ```

— see [Authenticating to GitHub Package Registry documentation on GitHub](https://help.github.com/en/articles/configuring-npm-for-use-with-github-package-registry#authenticating-to-github-package-registry)
