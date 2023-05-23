export const injectRibbon = ({ text }) => {
  const css = /* css */ `
      #jsenv_ribbon_container {
        position: absolute;
        z-index: 1001;
        top: 0;
        right: 0;
        width: 100px;
        height: 100px;
        overflow: hidden;
        opacity: 0.5;
        pointer-events: none;
      }
      #jsenv_ribbon {
        position: absolute;
        top: -10px;
        right: -10px;
        width: 100%;
        height: 100%;
      }
      #jsenv_ribbon_text {
        position: absolute;
        left: 0px;
        top: 20px;
        transform: rotate(45deg);
        display: block;
        width: 125px;
        line-height: 36px;
        background-color: orange;
        color: rgb(55, 7, 7);
        box-shadow: 0 5px 10px rgba(0, 0, 0, 0.1);
        font-weight: 700;
        font-size: 16px;
        font-family: "Lato", sans-serif;
        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
        text-align: center;
        user-select: none;
      }
    `;

  const html = /* html */ `<div id="jsenv_ribbon_container">
      <style>${css}</style>
      <div id="jsenv_ribbon">
        <div id="jsenv_ribbon_text">${text}</div>
      </div>
    </div>`;

  const node = document.createElement("div");
  node.innerHTML = html;

  const toolbarStateInLocalStorage = localStorage.hasOwnProperty(
    "jsenv_toolbar",
  )
    ? JSON.parse(localStorage.getItem("jsenv_toolbar"))
    : {};
  if (toolbarStateInLocalStorage.ribbonDisplayed === false) {
    node.querySelector("#jsenv_ribbon_container").style.display = "none";
  }
  document.body.appendChild(node.firstChild);
};
