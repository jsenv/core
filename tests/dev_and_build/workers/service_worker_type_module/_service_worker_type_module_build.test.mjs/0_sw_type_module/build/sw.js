self.resourcesFromJsenvBuild = {
  "/main.html": {},
  "/css/style.css": {
    "versionedUrl": null
  }
};
self.order = [];
self.addEventListener("message", async messageEvent => {
  if (messageEvent.data === "inspect") {
    messageEvent.ports[0].postMessage({
      order: self.order,
      resourcesFromJsenvBuild: self.resourcesFromJsenvBuild
    });
  }
});
const fn = ([a]) => {
  console.log(a);
};
fn(["a"]);