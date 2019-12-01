# Table of contents

- [Exploring presentation](#Exploring-presentation)
- [Exploring recorded video](#Exploring-recorded-video)

# Exploring presentation

Frontend projects often comes with a local server running on your machine.

These type of servers focuses on development. During development files change often and developper want a fast feedback to see effects of thoose changes.

You can use jsenv to start a server serving an html page containing a list of links to your project files. Each link goes to an url where your JavaScript file will be executed. Thanks to this, any file in your project can become an entry point. You can use it to debug a file in isolation, create a storybook and so on.

This tool is called exploring.

## Exploring recorded video

The following video was recorded to show exploring feature in action on a basic project. The developper opens a file and debugs it inside chrome.

![recording of me exploring a project using chrome](./exploring-with-chrome-recording.gif)
<br />
— gif generated from [./exploring-with-chrome-recording.mp4](./exploring-with-chrome-recording.mp4)

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

![exploring server chome screenshot](./exploring-server-chrome-screenshot.png)

- If you go to `http://127.0.0.1:3456/src/hello.js` page displays `Hello world`.
  It shows that if your file execution renders something, you can see the effect in your browser.
- If you go to `http://127.0.0.1:3456/src/text.js` nothing special will happen because `/src/text.js` is just a module with an export default.<br />
  It shows that even if your file do not render anything, you still can use this functionnality to debug your file.

Here is a gif showing me browing basic project files:

If you want to know more about `startExploringServer`, there is a dedicated page for that.<br />
— see [`startExploringServer` documentation](./start-exploring-server-doc.md)
