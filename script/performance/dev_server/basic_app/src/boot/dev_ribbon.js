export const injectDevRibbon = () => {
  const devRibbonContainer = document.createElement("div")
  devRibbonContainer.id = "dev_ribbon_container"
  devRibbonContainer.innerHTML = `
<div id="dev_ribbon">
  <div id="dev_ribbon_text">DEV</span>
</div>
<style>
#dev_ribbon_container {
  position: absolute;
  z-index: 1001;
  top: 0;
  right: 0;
  width: 100px;
  height: 100px;
  overflow: hidden;
}
#dev_ribbon {
  position: absolute;
  top: -10px;
  right: -10px;
  width: 100%;
  height: 100%;
}
#dev_ribbon_text {
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
</style>`
  document.body.appendChild(devRibbonContainer)
}
