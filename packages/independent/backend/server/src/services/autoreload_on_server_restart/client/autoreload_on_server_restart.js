const css = /* css */ `
dialog {
  opacity: 0;
  transition: all 0.3s allow-discrete;
}
dialog::backdrop {
   background-image: linear-gradient(
    45deg,
    magenta,
    rebeccapurple,
    dodgerblue,
    green
  );
  opacity: 0;
  transition: all 0.3s allow-discrete;
}
dialog:open {
  opacity: 1;
}
dialog:open::backdrop {
  opacity: 0.75;
}`;

const html = /* html */ `<style>
    ${css}
</style>
<dialog>
    <p>Connection with server is lost</p>
    <button autofocus name="reconnect">Retry</button>
</dialog>`;

class JsenvAutoreloadOnServerRestart extends HTMLElement {
  constructor({ url } = {}) {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = html;

    const dialog = root.querySelector("dialog");
    const reconnectButton = dialog.querySelector('button[name="reconnect"]');

    (async () => {
      const connect = () => {
        const websocket = new WebSocket(url);
        const connectedPromise = new Promise((resolve) => {
          websocket.onerror = () => {
            resolve(null);
          };
          websocket.onopen = () => {
            resolve(websocket);
          };
        });
        return connectedPromise;
      };

      const initialWebSocket = await connect();
      initialWebSocket.onclose = async () => {
        console.info("connection to server lost, trying to reconnect");
        const retry = async () => {
          let attemptCount = 0;
          let timeToWait = 100;
          const tryToReconnect = async () => {
            const newWebsocket = await connect();
            if (newWebsocket) {
              dialog.close();
              console.info("reconnected to server, reloading the page...");
              window.location.reload(true);
              return;
            }
            attemptCount++;
            if (attemptCount === 10) {
              dialog.showModal();
              reconnectButton.onclick = async () => {
                reconnectButton.disabled = true;
                const previousContext = reconnectButton.textContent;
                reconnectButton.textContent = "Retrying...";
                await retry();
                reconnectButton.textContent = previousContext;
                reconnectButton.disabled = false;
              };
              return;
            }
            timeToWait += 100;
            await new Promise((resolve) => setTimeout(resolve, timeToWait));
            await tryToReconnect();
          };
          await tryToReconnect();
        };
        retry();
      };
    })();
  }
}
if (!customElements.get("jsenv-autoreload-on-server-restart")) {
  customElements.define(
    "jsenv-autoreload-on-server-restart",
    JsenvAutoreloadOnServerRestart,
  );
}

const jsenvAutoreloadOnServerRestartElement =
  new JsenvAutoreloadOnServerRestart({
    url: (() => {
      const websocketScheme =
        self.location.protocol === "https:" ? "wss" : "ws";
      const websocketUrl = `${websocketScheme}://${self.location.host}/.internal/alive.websocket`;
      return websocketUrl;
    })(),
  });

// script is injected into document.body
if (document.body) {
  document.currentScript.parentNode.replaceChild(
    jsenvAutoreloadOnServerRestartElement,
    document.currentScript,
  );
}
// script injected outisde document.body (likely in head)
else {
  document.currentScript.parentNode.removeChild(document.currentScript);
  document.onreadystatechange = () => {
    if (document.readyState === "interactive") {
      document.body.appendChild(jsenvAutoreloadOnServerRestartElement);
    }
  };
}
