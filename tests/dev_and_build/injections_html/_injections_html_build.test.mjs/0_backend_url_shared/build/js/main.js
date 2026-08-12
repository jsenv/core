const p = document.querySelector("p");

window.resolveResultPromise({
  fromGlobal: `${window.backendUrl}/users/me`,
  fromTextNode: p.textContent,
  fromAttribute: p.getAttribute("data-backend-url"),
});