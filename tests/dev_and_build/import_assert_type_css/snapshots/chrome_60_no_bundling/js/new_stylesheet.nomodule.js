System.register([],(function(e,t){"use strict";return{setters:[],execute:function(){!function(){if("undefined"!=typeof document&&!("adoptedStyleSheets"in document)){var e="ShadyCSS"in window&&!ShadyCSS.nativeShadow,t=document.implementation.createHTMLDocument(""),n=new WeakMap,o="object"==typeof DOMException?Error:DOMException,r=Object.defineProperty,c=Array.prototype.forEach,i=/@import.+?;?$/gm,a=CSSStyleSheet.prototype;a.replace=function(){return Promise.reject(new o("Can't call replace on non-constructed CSSStyleSheets."))},a.replaceSync=function(){throw new o("Failed to execute 'replaceSync' on 'CSSStyleSheet': Can't call replaceSync on non-constructed CSSStyleSheets.")};var s=new WeakMap,u=new WeakMap,d=new WeakMap,f=new WeakMap,l=W.prototype;l.replace=function(e){try{return this.replaceSync(e),Promise.resolve(this)}catch(e){return Promise.reject(e)}},l.replaceSync=function(e){if(F(this),"string"==typeof e){var t=this;s.get(t).textContent=function(e){var t=e.replace(i,"");return t!==e&&console.warn("@import rules are not allowed here. See https://github.com/WICG/construct-stylesheets/issues/119#issuecomment-588352418"),t.trim()}(e),f.set(t,[]),u.get(t).forEach((function(e){e.isConnected()&&R(t,M(t,e))}))}},r(l,"cssRules",{configurable:!0,enumerable:!0,get:function(){return F(this),s.get(this).sheet.cssRules}}),r(l,"media",{configurable:!0,enumerable:!0,get:function(){return F(this),s.get(this).sheet.media}}),["addRule","deleteRule","insertRule","removeRule"].forEach((function(e){l[e]=function(){var t=this;F(t);var n=arguments;f.get(t).push({method:e,args:n}),u.get(t).forEach((function(o){if(o.isConnected()){var r=M(t,o).sheet;r[e].apply(r,n)}}));var o=s.get(t).sheet;return o[e].apply(o,n)}})),r(W,Symbol.hasInstance,{configurable:!0,value:C});var h={childList:!0,subtree:!0},p=new WeakMap,y=new WeakMap,S=new WeakMap,m=new WeakMap;if(N.prototype={isConnected:function(){var e=y.get(this);return e instanceof Document?"loading"!==e.readyState:function(e){return"isConnected"in e?e.isConnected:document.contains(e)}(e.host)},connect:function(){var e=x(this);m.get(this).observe(e,h),S.get(this).length>0&&D(this),k(e,(function(e){O(e).connect()}))},disconnect:function(){m.get(this).disconnect()},update:function(e){var t=this,n=y.get(t)===document?"Document":"ShadowRoot";if(!Array.isArray(e))throw new TypeError("Failed to set the 'adoptedStyleSheets' property on "+n+": Iterator getter is not callable.");if(!e.every(C))throw new TypeError("Failed to set the 'adoptedStyleSheets' property on "+n+": Failed to convert value to 'CSSStyleSheet'");if(e.some(b))throw new TypeError("Failed to set the 'adoptedStyleSheets' property on "+n+": Can't adopt non-constructed stylesheets");t.sheets=e;var o,r,c=S.get(t),i=(o=e).filter((function(e,t){return o.indexOf(e)===t}));(r=i,c.filter((function(e){return-1===r.indexOf(e)}))).forEach((function(e){var n;(n=M(e,t)).parentNode.removeChild(n),function(e,t){d.get(e).delete(t),u.set(e,u.get(e).filter((function(e){return e!==t})))}(e,t)})),S.set(t,i),t.isConnected()&&i.length>0&&D(t)}},window.CSSStyleSheet=W,T(Document),"ShadowRoot"in window){T(ShadowRoot);var g=Element.prototype,v=g.attachShadow;g.attachShadow=function(e){var t=v.call(this,e);return"closed"===e.mode&&n.set(this,t),t}}var w=O(document);w.isConnected()?w.connect():document.addEventListener("DOMContentLoaded",w.connect.bind(w))}function E(e){return e.shadowRoot||n.get(e)}function C(e){return"object"==typeof e&&(l.isPrototypeOf(e)||a.isPrototypeOf(e))}function b(e){return"object"==typeof e&&a.isPrototypeOf(e)}function M(e,t){return d.get(e).get(t)}function R(e,t){requestAnimationFrame((function(){t.textContent=s.get(e).textContent,f.get(e).forEach((function(e){return t.sheet[e.method].apply(t.sheet,e.args)}))}))}function F(e){if(!s.has(e))throw new TypeError("Illegal invocation")}function W(){var e=this,n=document.createElement("style");t.body.appendChild(n),s.set(e,n),u.set(e,[]),d.set(e,new WeakMap),f.set(e,[])}function O(e){var t=p.get(e);return t||(t=new N(e),p.set(e,t)),t}function T(e){r(e.prototype,"adoptedStyleSheets",{configurable:!0,enumerable:!0,get:function(){return O(this).sheets},set:function(e){O(this).update(e)}})}function k(e,t){for(var n=document.createNodeIterator(e,NodeFilter.SHOW_ELEMENT,(function(e){return E(e)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}),null,!1),o=void 0;o=n.nextNode();)t(E(o))}function x(e){var t=y.get(e);return t instanceof Document?t.body:t}function D(e){var t=document.createDocumentFragment(),n=S.get(e),o=m.get(e),r=x(e);o.disconnect(),n.forEach((function(n){t.appendChild(M(n,e)||function(e,t){var n=document.createElement("style");return d.get(e).set(t,n),u.get(e).push(t),n}(n,e))})),r.insertBefore(t,null),o.observe(r,h),n.forEach((function(t){R(t,M(t,e))}))}function N(t){var n=this;n.sheets=[],y.set(n,t),S.set(n,[]),m.set(n,new MutationObserver((function(t,o){document?t.forEach((function(t){e||c.call(t.addedNodes,(function(e){e instanceof Element&&k(e,(function(e){O(e).connect()}))})),c.call(t.removedNodes,(function(t){t instanceof Element&&(function(e,t){return t instanceof HTMLStyleElement&&S.get(e).some((function(t){return M(t,e)}))}(n,t)&&D(n),e||k(t,(function(e){O(e).disconnect()})))}))})):o.disconnect()})))}}()}}}));