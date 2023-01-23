
self.serviceWorkerUrls = {
  "/main.html": {
    "versioned": false,
    "version": "57647127"
  },
  "/css/style.css?v=0e312da1": {
    "versioned": true
  }
};
!function(e,r){if("function"==typeof define&&define.amd)define([],r);else if("undefined"!=typeof exports)r();else{r(),e.sw={}}}("undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:this,(function(){"use strict";var e;self.order=[],self.addEventListener("message",(e=function(e){return"inspect"===e.data&&e.ports[0].postMessage({order:self.order,serviceWorkerUrls:self.serviceWorkerUrls}),n?s?s(r):r:(r&&r.then||(r=Promise.resolve(r)),s?r.then(s):r);var r,s,n},function(){for(var r=[],s=0;s<arguments.length;s++)r[s]=arguments[s];try{return Promise.resolve(e.apply(this,r))}catch(e){return Promise.reject(e)}}));(([e])=>{console.log(e)})(["a"])}));