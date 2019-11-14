starts a server creating an html page listing your project files.<br />
Each link goes to an url where your JavaScript file will be executed.<br />
Thanks to this, any file or your project can become an entry point. You can use it to debug a file in isolation or even to create a storybook.

It has the following exports:

- `startExploringServer`

## How to use

To understand how to use jsenv exploring server let's use it on a "real" project.<br />
We will setup a basic project and start an exploring server inside it.

### Steps to start exploring server on a basic project

1. Create basic project file structure

   — see [./docs/basic-project](./docs/basic-project)

2. Install dependencies

   ```console
   npm install
   ```

3. Start the exploring server

   ```console
   node ./start-exploring-server.js
   ```

### Using the exploring server

A first main server will start. This one is used by the whole jsenv project.<br />
A second server will start. That's the one we're interested in right now. The url `http://127.0.0.1:3456` is logged in your terminal.<br />

Once server is started you can navigate to `http://127.0.0.1:3456` and you will see an html page listing the files you can explore.

![exploring server chome screenshot](./docs/exploring-server-chrome-screenshot.png)

- If you go to `http://127.0.0.1:3456/src/hello.js` page displays `Hello world`.
  It shows that if your file execution renders something, you can see the effect in your browser.
- If you go to `http://127.0.0.1:3456/src/text.js` nothing special will happen because `/src/text.js` is just a module with an export default.<br />
  It shows that even if your file do not render anything, you still can use this functionnality to debug your file.

Here is a gif showing me browing basic project files:

![recording of me exploring a project using chrome](./docs/exploring-with-chrome-recording.gif)

If you want to know more about `startExploringServer`, there is a dedicated page for that.<br />
— see [`startExploringServer` documentation](./docs/start-exploring-server-doc.md)
