# Use dev server to debug file within vscode

What if you could debug inside chrome the file currently opened in vscode?<br />

1. Install `debugger for chrome` vscode extension

Link to extension: https://marketplace.visualstudio.com/items?itemName=msjsdiag.debugger-for-chrome

2. Add a launch configuration in `root/.vscode/launch.json`

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "jsenv-chrome",
      "type": "chrome",
      "request": "launch",
      "url": "http://127.0.0.1:3456/${relativeFile}",
      "runtimeArgs": [
        "--allow-file-access-from-files",
        "--disable-web-security"
      ],
      "sourceMaps": true,
      "sourceMapPathOverrides": {
        "/*": "${workspaceFolder}/*"
      },
      "smartStep": true,
      "skipFiles": ["node_modules/**", "<node_internals>/**/*.js"]
    }
  ]
}
```

3. Start dev server

```shell
node ./start-dev-server.js
```

4. Start a debugging session using `jsenv chrome`

I made a video of the debugging session inside vscode. The gif below was generated from that video.

![recording of me debugging project inside vscode](./debugging-with-vscode-recording.gif)
