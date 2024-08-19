const url = import.meta.url;

const answer = 42;

console.log(url, answer);
window.resolveResultPromise({ url, answer });
