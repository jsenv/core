;(function(){var m = {"/js/ping.nomodule.js":"/js/ping.nomodule.js?v=77743856"}; self.__v__ = function (s) { return m[s] || s }; })();!function(){const e=Object.create(null),t=Object.create(null);let r=0;const n={},o="object"==typeof document,s=self,i=!o&&"function"==typeof s.WorkerGlobalScope&&s instanceof s.WorkerGlobalScope,c=i&&"function"==typeof self.skipWaiting;s.System=n;let a=s.location.href.split("#")[0].split("?")[0];const l=a.lastIndexOf("/");-1!==l&&(a=a.slice(0,l+1));const u=(e,t)=>new URL(e,t).href;if(o){const e=document.querySelector("base[href]");e&&(a=e.href),n.register=(e,n)=>{if(!document.currentScript)throw new Error("unexpected call to System.register (document.currentScript is undefined)");if(document.currentScript.__s__)return t[document.currentScript.src]=[e,n],null;const o=document.currentScript.src||`${window.location.href}__inline_script__${++r}`;return t[o]=[e,n],m(o)},n.instantiate=e=>{const t=o(e);return new Promise((function(r,n){let o,s;const i=e=>{o=e.filename,s=e.error};window.addEventListener("error",i),t.addEventListener("error",(()=>{window.removeEventListener("error",i),n(`An error occured while loading url with <script> for ${e}`)})),t.addEventListener("load",(()=>{window.removeEventListener("error",i),document.head.removeChild(t),o===e?n(s):r()})),document.head.appendChild(t)}))};const o=e=>{const t=document.createElement("script");return t.async=!0,e.indexOf(`${self.location.origin}/`)&&(t.crossOrigin="anonymous"),t.__s__=!0,t.src=e,t}}if(i){const e=[];if(c){const t=["message","install","activate","fetch"],r={},n=new Promise((t=>{e.push(t)}));t.forEach((t=>{const o=[];self.addEventListener(t,(e=>{const t=r[e.type];t?t(e):(o.push(e),e.waitUntil(n))})),e.push((()=>{if(o.length){const e=r[o[0].type];e&&o.forEach((t=>{e(t)})),o.length=0}}))}));const o=self.addEventListener;self.addEventListener=function(e,n,s){return t.indexOf(e)>-1?(r[e]=n,null):o.call(self,e,n,s)}}else{["message"].forEach((t=>{var r=[],n=e=>{r.push(e)};self.addEventListener(t,n),e.push((()=>{self.removeEventListener(t,n),r.forEach((function(e){self.dispatchEvent(e)})),r.length=0}))}))}n.register=async(r,o)=>{n.register=()=>{throw new Error("unexpected call to System.register (called outside url instantiation)")};const s=self.location.href;t[s]=[r,o];const i=await m(s);return e.forEach((e=>{e()})),e.length=0,i},n.instantiate=async e=>{const r=await self.fetch(e,{credentials:"same-origin"});if(!r.ok)throw Error(`Failed to fetch module at ${e}`);let o=await r.text();o.indexOf("//# sourceURL=")<0&&(o+=`\n//# sourceURL=${e}`);const s=n.register;n.register=(r,n)=>{t[e]=[r,n]},(0,self.eval)(o),n.register=s}}const m=(e,t)=>{const r=u(e,t),n=d(r,t);return n.completionPromise?n.completionPromise===n.namespace?Promise.resolve(n.namespace):n.completionPromise:f(n,t)},d=(r,o)=>{const s=e[r];if(s)return s;const i=g(),c={url:r,deps:[],dependencyLoads:[],instantiatePromise:null,linkPromise:null,executePromise:null,completionPromise:null,importerSetters:[],setters:[],execute:null,error:null,hoistedExports:!1,namespace:i};return e[r]=c,c.instantiatePromise=(async()=>{try{let e=t[r];if(!e){const s=n.instantiate(r,o);s&&await s,e=t[r]}if(!e)throw new Error(`System.register() not called after executing ${r}`);const s=(e,t)=>{c.hoistedExports=!0;let r=!1;if("string"==typeof e){const n=e,o=t;n in i&&i[n]===o||(i[n]=o,r=!0)}else Object.keys(e).forEach((t=>{const n=e[t];t in i&&i[t]===n||(i[t]=n,r=!0)})),e&&e.__esModule&&(i.__esModule=e.__esModule);return r&&c.importerSetters.forEach((e=>{e&&e(i)})),t},[a,l]=e,{setters:u,execute:d=(()=>{})}=l(s,{import:e=>m(e,r),meta:y(r)});c.deps=a,c.setters=u,c.execute=d}catch(e){c.error=e,c.execute=null}})(),c.linkPromise=(async()=>{await c.instantiatePromise;const e=await Promise.all(c.deps.map((async(e,t)=>{const n=c.setters[t],o=u(e,r),s=d(o,r);return s.instantiatePromise&&await s.instantiatePromise,n&&(s.importerSetters.push(n),!s.hoistedExports&&s.instantiatePromise||n(s.namespace)),s})));c.dependencyLoads=e})(),c},f=async(e,t)=>(e.completionPromise=(async()=>(await p(e,e,{}),await h(e,t?[t]:[]),e.namespace))(),e.completionPromise),p=async(e,t,r)=>{if(!r[e.url]){r[e.url]=!0;try{e.linkPromise&&await e.linkPromise,await Promise.all(e.dependencyLoads.map((e=>p(e,t,r))))}catch(t){if(e.error)throw t;throw e.execute=null,t}}},h=(e,t)=>{if(t.indexOf(e.url)>-1)return;if(!e.execute){if(e.error)throw e.error;return e.executePromise?e.executePromise:void 0}const r=e.execute;e.execute=null;const n=[];return e.dependencyLoads.forEach((r=>{try{const o=t.slice();o.push(e.url);const s=h(r,o);s&&n.push(s)}catch(t){throw e.error=t,t}})),(async()=>{if(n.length){const e=Promise.all(n);await e}try{const t=r.call(w);if(t)return void(e.executePromise=t.then((()=>{e.executePromise=null,e.completionPromise=e.namespace}),(t=>{throw e.executePromise=null,e.error=t,t})));e.instantiatePromise=null,e.linkPromise=null,e.completionPromise=e.namespace}catch(t){throw e.error=t,t}finally{e.execute=null}})()},w=Object.freeze(Object.create(null)),y=e=>({url:e,resolve:t=>u(t,e)}),g="undefined"!=typeof Symbol&&Symbol.toStringTag?()=>{const e=Object.create(null);return Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),e}:()=>Object.create(null)}(),System.register([__v__("/js/ping.nomodule.js")],(function(e,t){"use strict";var r;return{setters:[function(e){r=e.ping}],execute:function(){self.addEventListener("message",(function(e){"ping"===e.data&&self.postMessage(r)}))}}}));