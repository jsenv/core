var n$2,l$3,u$5,i$3,o$3,r$4,f$4,c$3={},s$2=[],a$3=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,h$2=Array.isArray;function v$4(n,l){for(var u in l)n[u]=l[u];return n}function p$4(n){var l=n.parentNode;l&&l.removeChild(n);}function y$2(l,u,t){var i,o,r,f={};for(r in u)"key"==r?i=u[r]:"ref"==r?o=u[r]:f[r]=u[r];if(arguments.length>2&&(f.children=arguments.length>3?n$2.call(arguments,2):t),"function"==typeof l&&null!=l.defaultProps)for(r in l.defaultProps)void 0===f[r]&&(f[r]=l.defaultProps[r]);return d$3(l,f,i,o,null)}function d$3(n,t,i,o,r){var f={type:n,props:t,key:i,ref:o,__k:null,__:null,__b:0,__e:null,__d:void 0,__c:null,constructor:void 0,__v:null==r?++u$5:r,__i:-1,__u:0};return null==r&&null!=l$3.vnode&&l$3.vnode(f),f}function g$4(n){return n.children}function b$3(n,l){this.props=n,this.context=l;}function m$3(n,l){if(null==l)return n.__?m$3(n.__,n.__i+1):null;for(var u;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e)return u.__e;return "function"==typeof n.type?m$3(n):null}function k$4(n){var l,u;if(null!=(n=n.__)&&null!=n.__c){for(n.__e=n.__c.base=null,l=0;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e){n.__e=n.__c.base=u.__e;break}return k$4(n)}}function w$4(n){(!n.__d&&(n.__d=!0)&&i$3.push(n)&&!x$3.__r++||o$3!==l$3.debounceRendering)&&((o$3=l$3.debounceRendering)||r$4)(x$3);}function x$3(){var n,u,t,o,r,e,c,s,a;for(i$3.sort(f$4);n=i$3.shift();)n.__d&&(u=i$3.length,o=void 0,e=(r=(t=n).__v).__e,s=[],a=[],(c=t.__P)&&((o=v$4({},r)).__v=r.__v+1,l$3.vnode&&l$3.vnode(o),L$2(c,o,r,t.__n,void 0!==c.ownerSVGElement,32&r.__u?[e]:null,s,null==e?m$3(r):e,!!(32&r.__u),a),o.__.__k[o.__i]=o,M$2(s,o,a),o.__e!=e&&k$4(o)),i$3.length>u&&i$3.sort(f$4));x$3.__r=0;}function C$3(n,l,u,t,i,o,r,f,e,a,h){var v,p,y,d,_,g=t&&t.__k||s$2,b=l.length;for(u.__d=e,P$3(u,l,g),e=u.__d,v=0;v<b;v++)null!=(y=u.__k[v])&&"boolean"!=typeof y&&"function"!=typeof y&&(p=-1===y.__i?c$3:g[y.__i]||c$3,y.__i=v,L$2(n,y,p,i,o,r,f,e,a,h),d=y.__e,y.ref&&p.ref!=y.ref&&(p.ref&&z$4(p.ref,null,y),h.push(y.ref,y.__c||d,y)),null==_&&null!=d&&(_=d),65536&y.__u||p.__k===y.__k?e=S$2(y,e,n):"function"==typeof y.type&&void 0!==y.__d?e=y.__d:d&&(e=d.nextSibling),y.__d=void 0,y.__u&=-196609);u.__d=e,u.__e=_;}function P$3(n,l,u){var t,i,o,r,f,e=l.length,c=u.length,s=c,a=0;for(n.__k=[],t=0;t<e;t++)null!=(i=n.__k[t]=null==(i=l[t])||"boolean"==typeof i||"function"==typeof i?null:"string"==typeof i||"number"==typeof i||"bigint"==typeof i||i.constructor==String?d$3(null,i,null,null,i):h$2(i)?d$3(g$4,{children:i},null,null,null):void 0===i.constructor&&i.__b>0?d$3(i.type,i.props,i.key,i.ref?i.ref:null,i.__v):i)?(i.__=n,i.__b=n.__b+1,f=H$2(i,u,r=t+a,s),i.__i=f,o=null,-1!==f&&(s--,(o=u[f])&&(o.__u|=131072)),null==o||null===o.__v?(-1==f&&a--,"function"!=typeof i.type&&(i.__u|=65536)):f!==r&&(f===r+1?a++:f>r?s>e-r?a+=f-r:a--:a=f<r&&f==r-1?f-r:0,f!==t+a&&(i.__u|=65536))):(o=u[t])&&null==o.key&&o.__e&&(o.__e==n.__d&&(n.__d=m$3(o)),N$2(o,o,!1),u[t]=null,s--);if(s)for(t=0;t<c;t++)null!=(o=u[t])&&0==(131072&o.__u)&&(o.__e==n.__d&&(n.__d=m$3(o)),N$2(o,o));}function S$2(n,l,u){var t,i;if("function"==typeof n.type){for(t=n.__k,i=0;t&&i<t.length;i++)t[i]&&(t[i].__=n,l=S$2(t[i],l,u));return l}return n.__e!=l&&(u.insertBefore(n.__e,l||null),l=n.__e),l&&l.nextSibling}function H$2(n,l,u,t){var i=n.key,o=n.type,r=u-1,f=u+1,e=l[u];if(null===e||e&&i==e.key&&o===e.type)return u;if(t>(null!=e&&0==(131072&e.__u)?1:0))for(;r>=0||f<l.length;){if(r>=0){if((e=l[r])&&0==(131072&e.__u)&&i==e.key&&o===e.type)return r;r--;}if(f<l.length){if((e=l[f])&&0==(131072&e.__u)&&i==e.key&&o===e.type)return f;f++;}}return -1}function I$2(n,l,u){"-"===l[0]?n.setProperty(l,null==u?"":u):n[l]=null==u?"":"number"!=typeof u||a$3.test(l)?u:u+"px";}function T$3(n,l,u,t,i){var o;n:if("style"===l)if("string"==typeof u)n.style.cssText=u;else {if("string"==typeof t&&(n.style.cssText=t=""),t)for(l in t)u&&l in u||I$2(n.style,l,"");if(u)for(l in u)t&&u[l]===t[l]||I$2(n.style,l,u[l]);}else if("o"===l[0]&&"n"===l[1])o=l!==(l=l.replace(/(PointerCapture)$|Capture$/,"$1")),l=l.toLowerCase()in n?l.toLowerCase().slice(2):l.slice(2),n.l||(n.l={}),n.l[l+o]=u,u?t?u.u=t.u:(u.u=Date.now(),n.addEventListener(l,o?D$3:A$3,o)):n.removeEventListener(l,o?D$3:A$3,o);else {if(i)l=l.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if("width"!==l&&"height"!==l&&"href"!==l&&"list"!==l&&"form"!==l&&"tabIndex"!==l&&"download"!==l&&"rowSpan"!==l&&"colSpan"!==l&&"role"!==l&&l in n)try{n[l]=null==u?"":u;break n}catch(n){}"function"==typeof u||(null==u||!1===u&&"-"!==l[4]?n.removeAttribute(l):n.setAttribute(l,u));}}function A$3(n){var u=this.l[n.type+!1];if(n.t){if(n.t<=u.u)return}else n.t=Date.now();return u(l$3.event?l$3.event(n):n)}function D$3(n){return this.l[n.type+!0](l$3.event?l$3.event(n):n)}function L$2(n,u,t,i,o,r,f,e,c,s){var a,p,y,d,_,m,k,w,x,P,S,$,H,I,T,A=u.type;if(void 0!==u.constructor)return null;128&t.__u&&(c=!!(32&t.__u),r=[e=u.__e=t.__e]),(a=l$3.__b)&&a(u);n:if("function"==typeof A)try{if(w=u.props,x=(a=A.contextType)&&i[a.__c],P=a?x?x.props.value:a.__:i,t.__c?k=(p=u.__c=t.__c).__=p.__E:("prototype"in A&&A.prototype.render?u.__c=p=new A(w,P):(u.__c=p=new b$3(w,P),p.constructor=A,p.render=O$2),x&&x.sub(p),p.props=w,p.state||(p.state={}),p.context=P,p.__n=i,y=p.__d=!0,p.__h=[],p._sb=[]),null==p.__s&&(p.__s=p.state),null!=A.getDerivedStateFromProps&&(p.__s==p.state&&(p.__s=v$4({},p.__s)),v$4(p.__s,A.getDerivedStateFromProps(w,p.__s))),d=p.props,_=p.state,p.__v=u,y)null==A.getDerivedStateFromProps&&null!=p.componentWillMount&&p.componentWillMount(),null!=p.componentDidMount&&p.__h.push(p.componentDidMount);else {if(null==A.getDerivedStateFromProps&&w!==d&&null!=p.componentWillReceiveProps&&p.componentWillReceiveProps(w,P),!p.__e&&(null!=p.shouldComponentUpdate&&!1===p.shouldComponentUpdate(w,p.__s,P)||u.__v===t.__v)){for(u.__v!==t.__v&&(p.props=w,p.state=p.__s,p.__d=!1),u.__e=t.__e,u.__k=t.__k,u.__k.forEach(function(n){n&&(n.__=u);}),S=0;S<p._sb.length;S++)p.__h.push(p._sb[S]);p._sb=[],p.__h.length&&f.push(p);break n}null!=p.componentWillUpdate&&p.componentWillUpdate(w,p.__s,P),null!=p.componentDidUpdate&&p.__h.push(function(){p.componentDidUpdate(d,_,m);});}if(p.context=P,p.props=w,p.__P=n,p.__e=!1,$=l$3.__r,H=0,"prototype"in A&&A.prototype.render){for(p.state=p.__s,p.__d=!1,$&&$(u),a=p.render(p.props,p.state,p.context),I=0;I<p._sb.length;I++)p.__h.push(p._sb[I]);p._sb=[];}else do{p.__d=!1,$&&$(u),a=p.render(p.props,p.state,p.context),p.state=p.__s;}while(p.__d&&++H<25);p.state=p.__s,null!=p.getChildContext&&(i=v$4(v$4({},i),p.getChildContext())),y||null==p.getSnapshotBeforeUpdate||(m=p.getSnapshotBeforeUpdate(d,_)),C$3(n,h$2(T=null!=a&&a.type===g$4&&null==a.key?a.props.children:a)?T:[T],u,t,i,o,r,f,e,c,s),p.base=u.__e,u.__u&=-161,p.__h.length&&f.push(p),k&&(p.__E=p.__=null);}catch(n){u.__v=null,c||null!=r?(u.__e=e,u.__u|=c?160:32,r[r.indexOf(e)]=null):(u.__e=t.__e,u.__k=t.__k),l$3.__e(n,u,t);}else null==r&&u.__v===t.__v?(u.__k=t.__k,u.__e=t.__e):u.__e=j$4(t.__e,u,t,i,o,r,f,c,s);(a=l$3.diffed)&&a(u);}function M$2(n,u,t){u.__d=void 0;for(var i=0;i<t.length;i++)z$4(t[i],t[++i],t[++i]);l$3.__c&&l$3.__c(u,n),n.some(function(u){try{n=u.__h,u.__h=[],n.some(function(n){n.call(u);});}catch(n){l$3.__e(n,u.__v);}});}function j$4(l,u,t,i,o,r,f,e,s){var a,v,y,d,_,g,b,k=t.props,w=u.props,x=u.type;if("svg"===x&&(o=!0),null!=r)for(a=0;a<r.length;a++)if((_=r[a])&&"setAttribute"in _==!!x&&(x?_.localName===x:3===_.nodeType)){l=_,r[a]=null;break}if(null==l){if(null===x)return document.createTextNode(w);l=o?document.createElementNS("http://www.w3.org/2000/svg",x):document.createElement(x,w.is&&w),r=null,e=!1;}if(null===x)k===w||e&&l.data===w||(l.data=w);else {if(r=r&&n$2.call(l.childNodes),k=t.props||c$3,!e&&null!=r)for(k={},a=0;a<l.attributes.length;a++)k[(_=l.attributes[a]).name]=_.value;for(a in k)_=k[a],"children"==a||("dangerouslySetInnerHTML"==a?y=_:"key"===a||a in w||T$3(l,a,null,_,o));for(a in w)_=w[a],"children"==a?d=_:"dangerouslySetInnerHTML"==a?v=_:"value"==a?g=_:"checked"==a?b=_:"key"===a||e&&"function"!=typeof _||k[a]===_||T$3(l,a,_,k[a],o);if(v)e||y&&(v.__html===y.__html||v.__html===l.innerHTML)||(l.innerHTML=v.__html),u.__k=[];else if(y&&(l.innerHTML=""),C$3(l,h$2(d)?d:[d],u,t,i,o&&"foreignObject"!==x,r,f,r?r[0]:t.__k&&m$3(t,0),e,s),null!=r)for(a=r.length;a--;)null!=r[a]&&p$4(r[a]);e||(a="value",void 0!==g&&(g!==l[a]||"progress"===x&&!g||"option"===x&&g!==k[a])&&T$3(l,a,g,k[a],!1),a="checked",void 0!==b&&b!==l[a]&&T$3(l,a,b,k[a],!1));}return l}function z$4(n,u,t){try{"function"==typeof n?n(u):n.current=u;}catch(n){l$3.__e(n,t);}}function N$2(n,u,t){var i,o;if(l$3.unmount&&l$3.unmount(n),(i=n.ref)&&(i.current&&i.current!==n.__e||z$4(i,null,u)),null!=(i=n.__c)){if(i.componentWillUnmount)try{i.componentWillUnmount();}catch(n){l$3.__e(n,u);}i.base=i.__P=null,n.__c=void 0;}if(i=n.__k)for(o=0;o<i.length;o++)i[o]&&N$2(i[o],u,t||"function"!=typeof n.type);t||null==n.__e||p$4(n.__e),n.__=n.__e=n.__d=void 0;}function O$2(n,l,u){return this.constructor(n,u)}function q$4(u,t,i){var o,r,f,e;l$3.__&&l$3.__(u,t),r=(o="function"==typeof i)?null:i&&i.__k||t.__k,f=[],e=[],L$2(t,u=(!o&&i||t).__k=y$2(g$4,null,[u]),r||c$3,c$3,void 0!==t.ownerSVGElement,!o&&i?[i]:r?null:t.firstChild?n$2.call(t.childNodes):null,f,!o&&i?i:r?r.__e:t.firstChild,o,e),M$2(f,u,e);}n$2=s$2.slice,l$3={__e:function(n,l,u,t){for(var i,o,r;l=l.__;)if((i=l.__c)&&!i.__)try{if((o=i.constructor)&&null!=o.getDerivedStateFromError&&(i.setState(o.getDerivedStateFromError(n)),r=i.__d),null!=i.componentDidCatch&&(i.componentDidCatch(n,t||{}),r=i.__d),r)return i.__E=i}catch(l){n=l;}throw n}},u$5=0,b$3.prototype.setState=function(n,l){var u;u=null!=this.__s&&this.__s!==this.state?this.__s:this.__s=v$4({},this.state),"function"==typeof n&&(n=n(v$4({},u),this.props)),n&&v$4(u,n),null!=n&&this.__v&&(l&&this._sb.push(l),w$4(this));},b$3.prototype.forceUpdate=function(n){this.__v&&(this.__e=!0,n&&this.__h.push(n),w$4(this));},b$3.prototype.render=g$4,i$3=[],r$4="function"==typeof Promise?Promise.prototype.then.bind(Promise.resolve()):setTimeout,f$4=function(n,l){return n.__v.__b-l.__v.__b},x$3.__r=0;

var n$1,l$2,u$4,i$2,o$2,r$3,f$3,e$2,c$2,s$1,a$2,h$1={},v$3=[],p$3=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,y$1=Array.isArray;function d$2(n,l){for(var u in l)n[u]=l[u];return n}function _$1(n){var l=n.parentNode;l&&l.removeChild(n);}function g$3(l,u,t){var i,o,r,f={};for(r in u)"key"==r?i=u[r]:"ref"==r?o=u[r]:f[r]=u[r];if(arguments.length>2&&(f.children=arguments.length>3?n$1.call(arguments,2):t),"function"==typeof l&&null!=l.defaultProps)for(r in l.defaultProps)void 0===f[r]&&(f[r]=l.defaultProps[r]);return b$2(l,f,i,o,null)}function b$2(n,t,i,o,r){var f={type:n,props:t,key:i,ref:o,__k:null,__:null,__b:0,__e:null,__d:void 0,__c:null,constructor:void 0,__v:null==r?++u$4:r,__i:-1,__u:0};return null==r&&null!=l$2.vnode&&l$2.vnode(f),f}function m$2(){return {current:null}}function w$3(n){return n.children}function k$3(n,l){this.props=n,this.context=l;}function x$2(n,l){if(null==l)return n.__?x$2(n.__,n.__i+1):null;for(var u;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e)return u.__e;return "function"==typeof n.type?x$2(n):null}function C$2(n){var l,u;if(null!=(n=n.__)&&null!=n.__c){for(n.__e=n.__c.base=null,l=0;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e){n.__e=n.__c.base=u.__e;break}return C$2(n)}}function P$2(n){(!n.__d&&(n.__d=!0)&&i$2.push(n)&&!S$1.__r++||o$2!==l$2.debounceRendering)&&((o$2=l$2.debounceRendering)||r$3)(S$1);}function S$1(){var n,u,t,o,r,e,c,s;for(i$2.sort(f$3);n=i$2.shift();)n.__d&&(u=i$2.length,o=void 0,e=(r=(t=n).__v).__e,c=[],s=[],t.__P&&((o=d$2({},r)).__v=r.__v+1,l$2.vnode&&l$2.vnode(o),O$1(t.__P,o,r,t.__n,void 0!==t.__P.ownerSVGElement,32&r.__u?[e]:null,c,null==e?x$2(r):e,!!(32&r.__u),s),o.__v=r.__v,o.__.__k[o.__i]=o,j$3(c,o,s),o.__e!=e&&C$2(o)),i$2.length>u&&i$2.sort(f$3));S$1.__r=0;}function $$1(n,l,u,t,i,o,r,f,e,c,s){var a,p,y,d,_,g=t&&t.__k||v$3,b=l.length;for(u.__d=e,I$1(u,l,g),e=u.__d,a=0;a<b;a++)null!=(y=u.__k[a])&&"boolean"!=typeof y&&"function"!=typeof y&&(p=-1===y.__i?h$1:g[y.__i]||h$1,y.__i=a,O$1(n,y,p,i,o,r,f,e,c,s),d=y.__e,y.ref&&p.ref!=y.ref&&(p.ref&&N$1(p.ref,null,y),s.push(y.ref,y.__c||d,y)),null==_&&null!=d&&(_=d),65536&y.__u||p.__k===y.__k?(e&&!e.isConnected&&(e=x$2(p)),e=H$1(y,e,n)):"function"==typeof y.type&&void 0!==y.__d?e=y.__d:d&&(e=d.nextSibling),y.__d=void 0,y.__u&=-196609);u.__d=e,u.__e=_;}function I$1(n,l,u){var t,i,o,r,f,e=l.length,c=u.length,s=c,a=0;for(n.__k=[],t=0;t<e;t++)r=t+a,null!=(i=n.__k[t]=null==(i=l[t])||"boolean"==typeof i||"function"==typeof i?null:"string"==typeof i||"number"==typeof i||"bigint"==typeof i||i.constructor==String?b$2(null,i,null,null,null):y$1(i)?b$2(w$3,{children:i},null,null,null):void 0===i.constructor&&i.__b>0?b$2(i.type,i.props,i.key,i.ref?i.ref:null,i.__v):i)?(i.__=n,i.__b=n.__b+1,f=A$2(i,u,r,s),i.__i=f,o=null,-1!==f&&(s--,(o=u[f])&&(o.__u|=131072)),null==o||null===o.__v?(-1==f&&a--,"function"!=typeof i.type&&(i.__u|=65536)):f!==r&&(f===r+1?a++:f>r?s>e-r?a+=f-r:a--:f<r?f==r-1&&(a=f-r):a=0,f!==t+a&&(i.__u|=65536))):(o=u[r])&&null==o.key&&o.__e&&0==(131072&o.__u)&&(o.__e==n.__d&&(n.__d=x$2(o)),q$3(o,o,!1),u[r]=null,s--);if(s)for(t=0;t<c;t++)null!=(o=u[t])&&0==(131072&o.__u)&&(o.__e==n.__d&&(n.__d=x$2(o)),q$3(o,o));}function H$1(n,l,u){var t,i;if("function"==typeof n.type){for(t=n.__k,i=0;t&&i<t.length;i++)t[i]&&(t[i].__=n,l=H$1(t[i],l,u));return l}n.__e!=l&&(u.insertBefore(n.__e,l||null),l=n.__e);do{l=l&&l.nextSibling;}while(null!=l&&8===l.nodeType);return l}function T$2(n,l){return l=l||[],null==n||"boolean"==typeof n||(y$1(n)?n.some(function(n){T$2(n,l);}):l.push(n)),l}function A$2(n,l,u,t){var i=n.key,o=n.type,r=u-1,f=u+1,e=l[u];if(null===e||e&&i==e.key&&o===e.type&&0==(131072&e.__u))return u;if(t>(null!=e&&0==(131072&e.__u)?1:0))for(;r>=0||f<l.length;){if(r>=0){if((e=l[r])&&0==(131072&e.__u)&&i==e.key&&o===e.type)return r;r--;}if(f<l.length){if((e=l[f])&&0==(131072&e.__u)&&i==e.key&&o===e.type)return f;f++;}}return -1}function F$2(n,l,u){"-"===l[0]?n.setProperty(l,null==u?"":u):n[l]=null==u?"":"number"!=typeof u||p$3.test(l)?u:u+"px";}function L$1(n,l,u,t,i){var o;n:if("style"===l)if("string"==typeof u)n.style.cssText=u;else {if("string"==typeof t&&(n.style.cssText=t=""),t)for(l in t)u&&l in u||F$2(n.style,l,"");if(u)for(l in u)t&&u[l]===t[l]||F$2(n.style,l,u[l]);}else if("o"===l[0]&&"n"===l[1])o=l!==(l=l.replace(/(PointerCapture)$|Capture$/i,"$1")),l=l.toLowerCase()in n||"onFocusOut"===l||"onFocusIn"===l?l.toLowerCase().slice(2):l.slice(2),n.l||(n.l={}),n.l[l+o]=u,u?t?u.u=t.u:(u.u=e$2,n.addEventListener(l,o?s$1:c$2,o)):n.removeEventListener(l,o?s$1:c$2,o);else {if(i)l=l.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if("width"!=l&&"height"!=l&&"href"!=l&&"list"!=l&&"form"!=l&&"tabIndex"!=l&&"download"!=l&&"rowSpan"!=l&&"colSpan"!=l&&"role"!=l&&l in n)try{n[l]=null==u?"":u;break n}catch(n){}"function"==typeof u||(null==u||!1===u&&"-"!==l[4]?n.removeAttribute(l):n.setAttribute(l,u));}}function M$1(n){return function(u){if(this.l){var t=this.l[u.type+n];if(null==u.t)u.t=e$2++;else if(u.t<t.u)return;return t(l$2.event?l$2.event(u):u)}}}function O$1(n,u,t,i,o,r,f,e,c,s){var a,h,v,p,_,g,b,m,x,C,P,S,I,H,T,A=u.type;if(void 0!==u.constructor)return null;128&t.__u&&(c=!!(32&t.__u),r=[e=u.__e=t.__e]),(a=l$2.__b)&&a(u);n:if("function"==typeof A)try{if(m=u.props,x=(a=A.contextType)&&i[a.__c],C=a?x?x.props.value:a.__:i,t.__c?b=(h=u.__c=t.__c).__=h.__E:("prototype"in A&&A.prototype.render?u.__c=h=new A(m,C):(u.__c=h=new k$3(m,C),h.constructor=A,h.render=B$2),x&&x.sub(h),h.props=m,h.state||(h.state={}),h.context=C,h.__n=i,v=h.__d=!0,h.__h=[],h._sb=[]),null==h.__s&&(h.__s=h.state),null!=A.getDerivedStateFromProps&&(h.__s==h.state&&(h.__s=d$2({},h.__s)),d$2(h.__s,A.getDerivedStateFromProps(m,h.__s))),p=h.props,_=h.state,h.__v=u,v)null==A.getDerivedStateFromProps&&null!=h.componentWillMount&&h.componentWillMount(),null!=h.componentDidMount&&h.__h.push(h.componentDidMount);else {if(null==A.getDerivedStateFromProps&&m!==p&&null!=h.componentWillReceiveProps&&h.componentWillReceiveProps(m,C),!h.__e&&(null!=h.shouldComponentUpdate&&!1===h.shouldComponentUpdate(m,h.__s,C)||u.__v===t.__v)){for(u.__v!==t.__v&&(h.props=m,h.state=h.__s,h.__d=!1),u.__e=t.__e,u.__k=t.__k,u.__k.forEach(function(n){n&&(n.__=u);}),P=0;P<h._sb.length;P++)h.__h.push(h._sb[P]);h._sb=[],h.__h.length&&f.push(h);break n}null!=h.componentWillUpdate&&h.componentWillUpdate(m,h.__s,C),null!=h.componentDidUpdate&&h.__h.push(function(){h.componentDidUpdate(p,_,g);});}if(h.context=C,h.props=m,h.__P=n,h.__e=!1,S=l$2.__r,I=0,"prototype"in A&&A.prototype.render){for(h.state=h.__s,h.__d=!1,S&&S(u),a=h.render(h.props,h.state,h.context),H=0;H<h._sb.length;H++)h.__h.push(h._sb[H]);h._sb=[];}else do{h.__d=!1,S&&S(u),a=h.render(h.props,h.state,h.context),h.state=h.__s;}while(h.__d&&++I<25);h.state=h.__s,null!=h.getChildContext&&(i=d$2(d$2({},i),h.getChildContext())),v||null==h.getSnapshotBeforeUpdate||(g=h.getSnapshotBeforeUpdate(p,_)),$$1(n,y$1(T=null!=a&&a.type===w$3&&null==a.key?a.props.children:a)?T:[T],u,t,i,o,r,f,e,c,s),h.base=u.__e,u.__u&=-161,h.__h.length&&f.push(h),b&&(h.__E=h.__=null);}catch(n){u.__v=null,c||null!=r?(u.__e=e,u.__u|=c?160:32,r[r.indexOf(e)]=null):(u.__e=t.__e,u.__k=t.__k),l$2.__e(n,u,t);}else null==r&&u.__v===t.__v?(u.__k=t.__k,u.__e=t.__e):u.__e=z$3(t.__e,u,t,i,o,r,f,c,s);(a=l$2.diffed)&&a(u);}function j$3(n,u,t){u.__d=void 0;for(var i=0;i<t.length;i++)N$1(t[i],t[++i],t[++i]);l$2.__c&&l$2.__c(u,n),n.some(function(u){try{n=u.__h,u.__h=[],n.some(function(n){n.call(u);});}catch(n){l$2.__e(n,u.__v);}});}function z$3(l,u,t,i,o,r,f,e,c){var s,a,v,p,d,g,b,m=t.props,w=u.props,k=u.type;if("svg"===k&&(o=!0),null!=r)for(s=0;s<r.length;s++)if((d=r[s])&&"setAttribute"in d==!!k&&(k?d.localName===k:3===d.nodeType)){l=d,r[s]=null;break}if(null==l){if(null===k)return document.createTextNode(w);l=o?document.createElementNS("http://www.w3.org/2000/svg",k):document.createElement(k,w.is&&w),r=null,e=!1;}if(null===k)m===w||e&&l.data===w||(l.data=w);else {if(r=r&&n$1.call(l.childNodes),m=t.props||h$1,!e&&null!=r)for(m={},s=0;s<l.attributes.length;s++)m[(d=l.attributes[s]).name]=d.value;for(s in m)d=m[s],"children"==s||("dangerouslySetInnerHTML"==s?v=d:"key"===s||s in w||L$1(l,s,null,d,o));for(s in w)d=w[s],"children"==s?p=d:"dangerouslySetInnerHTML"==s?a=d:"value"==s?g=d:"checked"==s?b=d:"key"===s||e&&"function"!=typeof d||m[s]===d||L$1(l,s,d,m[s],o);if(a)e||v&&(a.__html===v.__html||a.__html===l.innerHTML)||(l.innerHTML=a.__html),u.__k=[];else if(v&&(l.innerHTML=""),$$1(l,y$1(p)?p:[p],u,t,i,o&&"foreignObject"!==k,r,f,r?r[0]:t.__k&&x$2(t,0),e,c),null!=r)for(s=r.length;s--;)null!=r[s]&&_$1(r[s]);e||(s="value",void 0!==g&&(g!==l[s]||"progress"===k&&!g||"option"===k&&g!==m[s])&&L$1(l,s,g,m[s],!1),s="checked",void 0!==b&&b!==l[s]&&L$1(l,s,b,m[s],!1));}return l}function N$1(n,u,t){try{"function"==typeof n?n(u):n.current=u;}catch(n){l$2.__e(n,t);}}function q$3(n,u,t){var i,o;if(l$2.unmount&&l$2.unmount(n),(i=n.ref)&&(i.current&&i.current!==n.__e||N$1(i,null,u)),null!=(i=n.__c)){if(i.componentWillUnmount)try{i.componentWillUnmount();}catch(n){l$2.__e(n,u);}i.base=i.__P=null;}if(i=n.__k)for(o=0;o<i.length;o++)i[o]&&q$3(i[o],u,t||"function"!=typeof n.type);t||null==n.__e||_$1(n.__e),n.__c=n.__=n.__e=n.__d=void 0;}function B$2(n,l,u){return this.constructor(n,u)}function D$2(u,t,i){var o,r,f,e;l$2.__&&l$2.__(u,t),r=(o="function"==typeof i)?null:i&&i.__k||t.__k,f=[],e=[],O$1(t,u=(!o&&i||t).__k=g$3(w$3,null,[u]),r||h$1,h$1,void 0!==t.ownerSVGElement,!o&&i?[i]:r?null:t.firstChild?n$1.call(t.childNodes):null,f,!o&&i?i:r?r.__e:t.firstChild,o,e),j$3(f,u,e);}function E$1(n,l){D$2(n,l,E$1);}function G$1(l,u,t){var i,o,r,f,e=d$2({},l.props);for(r in l.type&&l.type.defaultProps&&(f=l.type.defaultProps),u)"key"==r?i=u[r]:"ref"==r?o=u[r]:e[r]=void 0===u[r]&&void 0!==f?f[r]:u[r];return arguments.length>2&&(e.children=arguments.length>3?n$1.call(arguments,2):t),b$2(l.type,e,i||l.key,o||l.ref,null)}function J$1(n,l){var u={__c:l="__cC"+a$2++,__:n,Consumer:function(n,l){return n.children(l)},Provider:function(n){var u,t;return this.getChildContext||(u=[],(t={})[l]=this,this.getChildContext=function(){return t},this.shouldComponentUpdate=function(n){this.props.value!==n.value&&u.some(function(n){n.__e=!0,P$2(n);});},this.sub=function(n){u.push(n);var l=n.componentWillUnmount;n.componentWillUnmount=function(){u.splice(u.indexOf(n),1),l&&l.call(n);};}),n.children}};return u.Provider.__=u.Consumer.contextType=u}n$1=v$3.slice,l$2={__e:function(n,l,u,t){for(var i,o,r;l=l.__;)if((i=l.__c)&&!i.__)try{if((o=i.constructor)&&null!=o.getDerivedStateFromError&&(i.setState(o.getDerivedStateFromError(n)),r=i.__d),null!=i.componentDidCatch&&(i.componentDidCatch(n,t||{}),r=i.__d),r)return i.__E=i}catch(l){n=l;}throw n}},u$4=0,k$3.prototype.setState=function(n,l){var u;u=null!=this.__s&&this.__s!==this.state?this.__s:this.__s=d$2({},this.state),"function"==typeof n&&(n=n(d$2({},u),this.props)),n&&d$2(u,n),null!=n&&this.__v&&(l&&this._sb.push(l),P$2(this));},k$3.prototype.forceUpdate=function(n){this.__v&&(this.__e=!0,n&&this.__h.push(n),P$2(this));},k$3.prototype.render=w$3,i$2=[],r$3="function"==typeof Promise?Promise.prototype.then.bind(Promise.resolve()):setTimeout,f$3=function(n,l){return n.__v.__b-l.__v.__b},S$1.__r=0,e$2=0,c$2=M$1(!1),s$1=M$1(!0),a$2=0;

var t$2,r$2,u$3,i$1,o$1=0,f$2=[],c$1=[],e$1=l$2,a$1=e$1.__b,v$2=e$1.__r,l$1=e$1.diffed,m$1=e$1.__c,s=e$1.unmount,d$1=e$1.__;function h(n,t){e$1.__h&&e$1.__h(r$2,n,o$1||t),o$1=0;var u=r$2.__H||(r$2.__H={__:[],__h:[]});return n>=u.__.length&&u.__.push({__V:c$1}),u.__[n]}function p$2(n){return o$1=1,y(D$1,n)}function y(n,u,i){var o=h(t$2++,2);if(o.t=n,!o.__c&&(o.__=[i?i(u):D$1(void 0,u),function(n){var t=o.__N?o.__N[0]:o.__[0],r=o.t(t,n);t!==r&&(o.__N=[r,o.__[1]],o.__c.setState({}));}],o.__c=r$2,!r$2.u)){var f=function(n,t,r){if(!o.__c.__H)return !0;var u=o.__c.__H.__.filter(function(n){return !!n.__c});if(u.every(function(n){return !n.__N}))return !c||c.call(this,n,t,r);var i=!1;return u.forEach(function(n){if(n.__N){var t=n.__[0];n.__=n.__N,n.__N=void 0,t!==n.__[0]&&(i=!0);}}),!(!i&&o.__c.props===n)&&(!c||c.call(this,n,t,r))};r$2.u=!0;var c=r$2.shouldComponentUpdate,e=r$2.componentWillUpdate;r$2.componentWillUpdate=function(n,t,r){if(this.__e){var u=c;c=void 0,f(n,t,r),c=u;}e&&e.call(this,n,t,r);},r$2.shouldComponentUpdate=f;}return o.__N||o.__}function _(n,u){var i=h(t$2++,3);!e$1.__s&&C$1(i.__H,u)&&(i.__=n,i.i=u,r$2.__H.__h.push(i));}function A$1(n,u){var i=h(t$2++,4);!e$1.__s&&C$1(i.__H,u)&&(i.__=n,i.i=u,r$2.__h.push(i));}function F$1(n){return o$1=5,q$2(function(){return {current:n}},[])}function T$1(n,t,r){o$1=6,A$1(function(){return "function"==typeof n?(n(t()),function(){return n(null)}):n?(n.current=t(),function(){return n.current=null}):void 0},null==r?r:r.concat(n));}function q$2(n,r){var u=h(t$2++,7);return C$1(u.__H,r)?(u.__V=n(),u.i=r,u.__h=n,u.__V):u.__}function x$1(n,t){return o$1=8,q$2(function(){return n},t)}function P$1(n){var u=r$2.context[n.__c],i=h(t$2++,9);return i.c=n,u?(null==i.__&&(i.__=!0,u.sub(r$2)),u.props.value):n.__}function V$1(n,t){e$1.useDebugValue&&e$1.useDebugValue(t?t(n):n);}function b$1(n){var u=h(t$2++,10),i=p$2();return u.__=n,r$2.componentDidCatch||(r$2.componentDidCatch=function(n,t){u.__&&u.__(n,t),i[1](n);}),[i[0],function(){i[1](void 0);}]}function g$2(){var n=h(t$2++,11);if(!n.__){for(var u=r$2.__v;null!==u&&!u.__m&&null!==u.__;)u=u.__;var i=u.__m||(u.__m=[0,0]);n.__="P"+i[0]+"-"+i[1]++;}return n.__}function j$2(){for(var n;n=f$2.shift();)if(n.__P&&n.__H)try{n.__H.__h.forEach(z$2),n.__H.__h.forEach(B$1),n.__H.__h=[];}catch(t){n.__H.__h=[],e$1.__e(t,n.__v);}}e$1.__b=function(n){r$2=null,a$1&&a$1(n);},e$1.__=function(n,t){n&&t.__k&&t.__k.__m&&(n.__m=t.__k.__m),d$1&&d$1(n,t);},e$1.__r=function(n){v$2&&v$2(n),t$2=0;var i=(r$2=n.__c).__H;i&&(u$3===r$2?(i.__h=[],r$2.__h=[],i.__.forEach(function(n){n.__N&&(n.__=n.__N),n.__V=c$1,n.__N=n.i=void 0;})):(i.__h.forEach(z$2),i.__h.forEach(B$1),i.__h=[],t$2=0)),u$3=r$2;},e$1.diffed=function(n){l$1&&l$1(n);var t=n.__c;t&&t.__H&&(t.__H.__h.length&&(1!==f$2.push(t)&&i$1===e$1.requestAnimationFrame||((i$1=e$1.requestAnimationFrame)||w$2)(j$2)),t.__H.__.forEach(function(n){n.i&&(n.__H=n.i),n.__V!==c$1&&(n.__=n.__V),n.i=void 0,n.__V=c$1;})),u$3=r$2=null;},e$1.__c=function(n,t){t.some(function(n){try{n.__h.forEach(z$2),n.__h=n.__h.filter(function(n){return !n.__||B$1(n)});}catch(r){t.some(function(n){n.__h&&(n.__h=[]);}),t=[],e$1.__e(r,n.__v);}}),m$1&&m$1(n,t);},e$1.unmount=function(n){s&&s(n);var t,r=n.__c;r&&r.__H&&(r.__H.__.forEach(function(n){try{z$2(n);}catch(n){t=n;}}),r.__H=void 0,t&&e$1.__e(t,r.__v));};var k$2="function"==typeof requestAnimationFrame;function w$2(n){var t,r=function(){clearTimeout(u),k$2&&cancelAnimationFrame(t),setTimeout(n);},u=setTimeout(r,100);k$2&&(t=requestAnimationFrame(r));}function z$2(n){var t=r$2,u=n.__c;"function"==typeof u&&(n.__c=void 0,u()),r$2=t;}function B$1(n){var t=r$2;n.__c=n.__(),r$2=t;}function C$1(n,t){return !n||n.length!==t.length||t.some(function(t,r){return t!==n[r]})}function D$1(n,t){return "function"==typeof t?t(n):t}

function S(n,t){for(var e in t)n[e]=t[e];return n}function C(n,t){for(var e in n)if("__source"!==e&&!(e in t))return !0;for(var r in t)if("__source"!==r&&n[r]!==t[r])return !0;return !1}function E(n,t){this.props=n,this.context=t;}function w$1(n,e){function r(n){var t=this.props.ref,r=t==n.ref;return !r&&t&&(t.call?t(null):t.current=null),e?!e(this.props,n)||!r:C(this.props,n)}function u(e){return this.shouldComponentUpdate=r,g$3(n,e)}return u.displayName="Memo("+(n.displayName||n.name)+")",u.prototype.isReactComponent=!0,u.__f=!0,u}(E.prototype=new k$3).isPureReactComponent=!0,E.prototype.shouldComponentUpdate=function(n,t){return C(this.props,n)||C(this.state,t)};var x=l$2.__b;l$2.__b=function(n){n.type&&n.type.__f&&n.ref&&(n.props.ref=n.ref,n.ref=null),x&&x(n);};var R="undefined"!=typeof Symbol&&Symbol.for&&Symbol.for("react.forward_ref")||3911;function N(n){function t(t){var e=S({},t);return delete e.ref,n(e,t.ref||null)}return t.$$typeof=R,t.render=t,t.prototype.isReactComponent=t.__f=!0,t.displayName="ForwardRef("+(n.displayName||n.name)+")",t}var k$1=function(n,t){return null==n?null:T$2(T$2(n).map(t))},A={map:k$1,forEach:k$1,count:function(n){return n?T$2(n).length:0},only:function(n){var t=T$2(n);if(1!==t.length)throw "Children.only";return t[0]},toArray:T$2},M=l$2.__e;l$2.__e=function(n,t,e,r){if(n.then)for(var u,o=t;o=o.__;)if((u=o.__c)&&u.__c)return null==t.__e&&(t.__e=e.__e,t.__k=e.__k),u.__c(n,t);M(n,t,e,r);};var O=l$2.unmount;function T(n,t,e){return n&&(n.__c&&n.__c.__H&&(n.__c.__H.__.forEach(function(n){"function"==typeof n.__c&&n.__c();}),n.__c.__H=null),null!=(n=S({},n)).__c&&(n.__c.__P===e&&(n.__c.__P=t),n.__c=null),n.__k=n.__k&&n.__k.map(function(n){return T(n,t,e)})),n}function F(n,t,e){return n&&e&&(n.__v=null,n.__k=n.__k&&n.__k.map(function(n){return F(n,t,e)}),n.__c&&n.__c.__P===t&&(n.__e&&e.appendChild(n.__e),n.__c.__e=!0,n.__c.__P=e)),n}function I(){this.__u=0,this.t=null,this.__b=null;}function L(n){var t=n.__.__c;return t&&t.__a&&t.__a(n)}function U(n){var e,r,u;function o(o){if(e||(e=n()).then(function(n){r=n.default||n;},function(n){u=n;}),u)throw u;if(!r)throw e;return g$3(r,o)}return o.displayName="Lazy",o.__f=!0,o}function D(){this.u=null,this.o=null;}l$2.unmount=function(n){var t=n.__c;t&&t.__R&&t.__R(),t&&32&n.__u&&(n.type=null),O&&O(n);},(I.prototype=new k$3).__c=function(n,t){var e=t.__c,r=this;null==r.t&&(r.t=[]),r.t.push(e);var u=L(r.__v),o=!1,i=function(){o||(o=!0,e.__R=null,u?u(l):l());};e.__R=i;var l=function(){if(!--r.__u){if(r.state.__a){var n=r.state.__a;r.__v.__k[0]=F(n,n.__c.__P,n.__c.__O);}var t;for(r.setState({__a:r.__b=null});t=r.t.pop();)t.forceUpdate();}};r.__u++||32&t.__u||r.setState({__a:r.__b=r.__v.__k[0]}),n.then(i,i);},I.prototype.componentWillUnmount=function(){this.t=[];},I.prototype.render=function(n,e){if(this.__b){if(this.__v.__k){var r=document.createElement("div"),o=this.__v.__k[0].__c;this.__v.__k[0]=T(this.__b,r,o.__O=o.__P);}this.__b=null;}var i=e.__a&&g$3(w$3,null,n.fallback);return i&&(i.__u&=-33),[g$3(w$3,null,e.__a?null:n.children),i]};var V=function(n,t,e){if(++e[1]===e[0]&&n.o.delete(t),n.props.revealOrder&&("t"!==n.props.revealOrder[0]||!n.o.size))for(e=n.u;e;){for(;e.length>3;)e.pop()();if(e[1]<e[0])break;n.u=e=e[2];}};function W(n){return this.getChildContext=function(){return n.context},n.children}function P(n){var e=this,r=n.i;e.componentWillUnmount=function(){D$2(null,e.l),e.l=null,e.i=null;},e.i&&e.i!==r&&e.componentWillUnmount(),e.l||(e.i=r,e.l={nodeType:1,parentNode:r,childNodes:[],appendChild:function(n){this.childNodes.push(n),e.i.appendChild(n);},insertBefore:function(n,t){this.childNodes.push(n),e.i.appendChild(n);},removeChild:function(n){this.childNodes.splice(this.childNodes.indexOf(n)>>>1,1),e.i.removeChild(n);}}),D$2(g$3(W,{context:e.context},n.__v),e.l);}function j$1(n,e){var r=g$3(P,{__v:n,i:e});return r.containerInfo=e,r}(D.prototype=new k$3).__a=function(n){var t=this,e=L(t.__v),r=t.o.get(n);return r[0]++,function(u){var o=function(){t.props.revealOrder?(r.push(u),V(t,n,r)):u();};e?e(o):o();}},D.prototype.render=function(n){this.u=null,this.o=new Map;var t=T$2(n.children);n.revealOrder&&"b"===n.revealOrder[0]&&t.reverse();for(var e=t.length;e--;)this.o.set(t[e],this.u=[1,0,this.u]);return n.children},D.prototype.componentDidUpdate=D.prototype.componentDidMount=function(){var n=this;this.o.forEach(function(t,e){V(n,e,t);});};var z$1="undefined"!=typeof Symbol&&Symbol.for&&Symbol.for("react.element")||60103,B=/^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/,H=/^on(Ani|Tra|Tou|BeforeInp|Compo)/,Z=/[A-Z0-9]/g,Y="undefined"!=typeof document,$=function(n){return ("undefined"!=typeof Symbol&&"symbol"==typeof Symbol()?/fil|che|rad/:/fil|che|ra/).test(n)};function q$1(n,t,e){return null==t.__k&&(t.textContent=""),D$2(n,t),"function"==typeof e&&e(),n?n.__c:null}function G(n,t,e){return E$1(n,t),"function"==typeof e&&e(),n?n.__c:null}k$3.prototype.isReactComponent={},["componentWillMount","componentWillReceiveProps","componentWillUpdate"].forEach(function(t){Object.defineProperty(k$3.prototype,t,{configurable:!0,get:function(){return this["UNSAFE_"+t]},set:function(n){Object.defineProperty(this,t,{configurable:!0,writable:!0,value:n});}});});var J=l$2.event;function K(){}function Q(){return this.cancelBubble}function X(){return this.defaultPrevented}l$2.event=function(n){return J&&(n=J(n)),n.persist=K,n.isPropagationStopped=Q,n.isDefaultPrevented=X,n.nativeEvent=n};var nn,tn={enumerable:!1,configurable:!0,get:function(){return this.class}},en=l$2.vnode;l$2.vnode=function(n){"string"==typeof n.type&&function(n){var t=n.props,e=n.type,u={};for(var o in t){var i=t[o];if(!("value"===o&&"defaultValue"in t&&null==i||Y&&"children"===o&&"noscript"===e||"class"===o||"className"===o)){var l=o.toLowerCase();"defaultValue"===o&&"value"in t&&null==t.value?o="value":"download"===o&&!0===i?i="":"translate"===l&&"no"===i?i=!1:"ondoubleclick"===l?o="ondblclick":"onchange"!==l||"input"!==e&&"textarea"!==e||$(t.type)?"onfocus"===l?o="onfocusin":"onblur"===l?o="onfocusout":H.test(o)?o=l:-1===e.indexOf("-")&&B.test(o)?o=o.replace(Z,"-$&").toLowerCase():null===i&&(i=void 0):l=o="oninput","oninput"===l&&u[o=l]&&(o="oninputCapture"),u[o]=i;}}"select"==e&&u.multiple&&Array.isArray(u.value)&&(u.value=T$2(t.children).forEach(function(n){n.props.selected=-1!=u.value.indexOf(n.props.value);})),"select"==e&&null!=u.defaultValue&&(u.value=T$2(t.children).forEach(function(n){n.props.selected=u.multiple?-1!=u.defaultValue.indexOf(n.props.value):u.defaultValue==n.props.value;})),t.class&&!t.className?(u.class=t.class,Object.defineProperty(u,"className",tn)):(t.className&&!t.class||t.class&&t.className)&&(u.class=u.className=t.className),n.props=u;}(n),n.$$typeof=z$1,en&&en(n);};var rn=l$2.__r;l$2.__r=function(n){rn&&rn(n),nn=n.__c;};var un=l$2.diffed;l$2.diffed=function(n){un&&un(n);var t=n.props,e=n.__e;null!=e&&"textarea"===n.type&&"value"in t&&t.value!==e.value&&(e.value=null==t.value?"":t.value),nn=null;};var on={ReactCurrentDispatcher:{current:{readContext:function(n){return nn.__n[n.__c].props.value}}}},ln="17.0.2";function cn(n){return g$3.bind(null,n)}function fn(n){return !!n&&n.$$typeof===z$1}function an(n){return fn(n)&&n.type===w$3}function sn(n){return !!n&&!!n.displayName&&("string"==typeof n.displayName||n.displayName instanceof String)&&n.displayName.startsWith("Memo(")}function hn(n){return fn(n)?G$1.apply(null,arguments):n}function vn(n){return !!n.__k&&(D$2(null,n),!0)}function dn(n){return n&&(n.base||1===n.nodeType&&n)||null}var pn=function(n,t){return n(t)},mn=function(n,t){return n(t)},yn=w$3;function _n(n){n();}function bn(n){return n}function gn(){return [!1,_n]}var Sn=A$1,Cn=fn;function En(n,t){var e=t(),r=p$2({h:{__:e,v:t}}),u=r[0].h,o=r[1];return A$1(function(){u.__=e,u.v=t,wn(u)&&o({h:u});},[n,e,t]),_(function(){return wn(u)&&o({h:u}),n(function(){wn(u)&&o({h:u});})},[n]),e}function wn(n){var t,e,r=n.v,u=n.__;try{var o=r();return !((t=u)===(e=o)&&(0!==t||1/t==1/e)||t!=t&&e!=e)}catch(n){return !0}}var xn={useState:p$2,useId:g$2,useReducer:y,useEffect:_,useLayoutEffect:A$1,useInsertionEffect:Sn,useTransition:gn,useDeferredValue:bn,useSyncExternalStore:En,startTransition:_n,useRef:F$1,useImperativeHandle:T$1,useMemo:q$2,useCallback:x$1,useContext:P$1,useDebugValue:V$1,version:"17.0.2",Children:A,render:q$1,hydrate:G,unmountComponentAtNode:vn,createPortal:j$1,createElement:g$3,createContext:J$1,createFactory:cn,cloneElement:hn,createRef:m$2,Fragment:w$3,isValidElement:fn,isElement:Cn,isFragment:an,isMemo:sn,findDOMNode:dn,Component:k$3,PureComponent:E,memo:w$1,forwardRef:N,flushSync:mn,unstable_batchedUpdates:pn,StrictMode:yn,Suspense:I,SuspenseList:D,lazy:U,__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED:on};

const ReactOriginal = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	Children: A,
	Component: k$3,
	Fragment: w$3,
	PureComponent: E,
	StrictMode: yn,
	Suspense: I,
	SuspenseList: D,
	__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: on,
	cloneElement: hn,
	createContext: J$1,
	createElement: g$3,
	createFactory: cn,
	createPortal: j$1,
	createRef: m$2,
	default: xn,
	findDOMNode: dn,
	flushSync: mn,
	forwardRef: N,
	hydrate: G,
	isElement: Cn,
	isFragment: an,
	isMemo: sn,
	isValidElement: fn,
	lazy: U,
	memo: w$1,
	render: q$1,
	startTransition: _n,
	unmountComponentAtNode: vn,
	unstable_batchedUpdates: pn,
	useCallback: x$1,
	useContext: P$1,
	useDebugValue: V$1,
	useDeferredValue: bn,
	useEffect: _,
	useErrorBoundary: b$1,
	useId: g$2,
	useImperativeHandle: T$1,
	useInsertionEffect: Sn,
	useLayoutEffect: A$1,
	useMemo: q$2,
	useReducer: y,
	useRef: F$1,
	useState: p$2,
	useSyncExternalStore: En,
	useTransition: gn,
	version: ln
}, Symbol.toStringTag, { value: 'Module' }));

var withSelector = {exports: {}};

var useSyncExternalStoreWithSelector_production_min = {};

/**
 * @license React
 * use-sync-external-store-with-selector.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var g$1=xn;function n(a,b){return a===b&&(0!==a||1/a===1/b)||a!==a&&b!==b}var p$1="function"===typeof Object.is?Object.is:n,q=g$1.useSyncExternalStore,r$1=g$1.useRef,t$1=g$1.useEffect,u$2=g$1.useMemo,v$1=g$1.useDebugValue;
useSyncExternalStoreWithSelector_production_min.useSyncExternalStoreWithSelector=function(a,b,e,l,h){var c=r$1(null);if(null===c.current){var f={hasValue:!1,value:null};c.current=f;}else f=c.current;c=u$2(function(){function a(a){if(!c){c=!0;d=a;a=l(a);if(void 0!==h&&f.hasValue){var b=f.value;if(h(b,a))return k=b}return k=a}b=k;if(p$1(d,a))return b;var e=l(a);if(void 0!==h&&h(b,e))return b;d=a;return k=e}var c=!1,d,k,m=void 0===e?null:e;return [function(){return a(b())},null===m?void 0:function(){return a(m())}]},[b,e,l,h]);var d=q(a,c[0],c[1]);
t$1(function(){f.hasValue=!0;f.value=d;},[d]);v$1(d);return d};

{
  withSelector.exports = useSyncExternalStoreWithSelector_production_min;
}

var withSelectorExports = withSelector.exports;

var useSyncExternalStoreWithSelector$1 = withSelectorExports.useSyncExternalStoreWithSelector;

// src/index.ts
var React = (
  // prettier-ignore
  // @ts-ignore
  "default" in ReactOriginal ? xn : ReactOriginal
);

// src/components/Context.ts
var ContextKey = Symbol.for(`react-redux-context`);
var gT = typeof globalThis !== "undefined" ? globalThis : (
  /* fall back to a per-module scope (pre-8.1 behaviour) if `globalThis` is not available */
  {}
);
function getContext() {
  if (!React.createContext)
    return {};
  const contextMap = gT[ContextKey] ?? (gT[ContextKey] = /* @__PURE__ */ new Map());
  let realContext = contextMap.get(React.createContext);
  if (!realContext) {
    realContext = React.createContext(
      null
    );
    contextMap.set(React.createContext, realContext);
  }
  return realContext;
}
var ReactReduxContext = /* @__PURE__ */ getContext();

// src/utils/useSyncExternalStore.ts
var notInitialized = () => {
  throw new Error("uSES not initialized!");
};

// src/hooks/useReduxContext.ts
function createReduxContextHook(context = ReactReduxContext) {
  return function useReduxContext2() {
    const contextValue = React.useContext(context);
    return contextValue;
  };
}
var useReduxContext = /* @__PURE__ */ createReduxContextHook();

// src/hooks/useSelector.ts
var useSyncExternalStoreWithSelector = notInitialized;
var initializeUseSelector = (fn) => {
  useSyncExternalStoreWithSelector = fn;
};
var refEquality = (a, b) => a === b;
function createSelectorHook(context = ReactReduxContext) {
  const useReduxContext2 = context === ReactReduxContext ? useReduxContext : createReduxContextHook(context);
  return function useSelector2(selector, equalityFnOrOptions = {}) {
    const { equalityFn = refEquality, devModeChecks = {} } = typeof equalityFnOrOptions === "function" ? { equalityFn: equalityFnOrOptions } : equalityFnOrOptions;
    const {
      store,
      subscription,
      getServerState,
      stabilityCheck,
      identityFunctionCheck
    } = useReduxContext2();
    React.useRef(true);
    const wrappedSelector = React.useCallback(
      {
        [selector.name](state) {
          const selected = selector(state);
          return selected;
        }
      }[selector.name],
      [selector, stabilityCheck, devModeChecks.stabilityCheck]
    );
    const selectedState = useSyncExternalStoreWithSelector(
      subscription.addNestedSub,
      store.getState,
      getServerState || store.getState,
      wrappedSelector,
      equalityFn
    );
    React.useDebugValue(selectedState);
    return selectedState;
  };
}
var useSelector = /* @__PURE__ */ createSelectorHook();

// src/utils/batch.ts
function defaultNoopBatch(callback) {
  callback();
}

// src/utils/Subscription.ts
function createListenerCollection() {
  let first = null;
  let last = null;
  return {
    clear() {
      first = null;
      last = null;
    },
    notify() {
      defaultNoopBatch(() => {
        let listener = first;
        while (listener) {
          listener.callback();
          listener = listener.next;
        }
      });
    },
    get() {
      let listeners = [];
      let listener = first;
      while (listener) {
        listeners.push(listener);
        listener = listener.next;
      }
      return listeners;
    },
    subscribe(callback) {
      let isSubscribed = true;
      let listener = last = {
        callback,
        next: null,
        prev: last
      };
      if (listener.prev) {
        listener.prev.next = listener;
      } else {
        first = listener;
      }
      return function unsubscribe() {
        if (!isSubscribed || first === null)
          return;
        isSubscribed = false;
        if (listener.next) {
          listener.next.prev = listener.prev;
        } else {
          last = listener.prev;
        }
        if (listener.prev) {
          listener.prev.next = listener.next;
        } else {
          first = listener.next;
        }
      };
    }
  };
}
var nullListeners = {
  notify() {
  },
  get: () => []
};
function createSubscription(store, parentSub) {
  let unsubscribe;
  let listeners = nullListeners;
  let subscriptionsAmount = 0;
  let selfSubscribed = false;
  function addNestedSub(listener) {
    trySubscribe();
    const cleanupListener = listeners.subscribe(listener);
    let removed = false;
    return () => {
      if (!removed) {
        removed = true;
        cleanupListener();
        tryUnsubscribe();
      }
    };
  }
  function notifyNestedSubs() {
    listeners.notify();
  }
  function handleChangeWrapper() {
    if (subscription.onStateChange) {
      subscription.onStateChange();
    }
  }
  function isSubscribed() {
    return selfSubscribed;
  }
  function trySubscribe() {
    subscriptionsAmount++;
    if (!unsubscribe) {
      unsubscribe = parentSub ? parentSub.addNestedSub(handleChangeWrapper) : store.subscribe(handleChangeWrapper);
      listeners = createListenerCollection();
    }
  }
  function tryUnsubscribe() {
    subscriptionsAmount--;
    if (unsubscribe && subscriptionsAmount === 0) {
      unsubscribe();
      unsubscribe = void 0;
      listeners.clear();
      listeners = nullListeners;
    }
  }
  function trySubscribeSelf() {
    if (!selfSubscribed) {
      selfSubscribed = true;
      trySubscribe();
    }
  }
  function tryUnsubscribeSelf() {
    if (selfSubscribed) {
      selfSubscribed = false;
      tryUnsubscribe();
    }
  }
  const subscription = {
    addNestedSub,
    notifyNestedSubs,
    handleChangeWrapper,
    isSubscribed,
    trySubscribe: trySubscribeSelf,
    tryUnsubscribe: tryUnsubscribeSelf,
    getListeners: () => listeners
  };
  return subscription;
}

// src/utils/useIsomorphicLayoutEffect.ts
var canUseDOM = !!(typeof window !== "undefined" && typeof window.document !== "undefined" && typeof window.document.createElement !== "undefined");
var useIsomorphicLayoutEffect = canUseDOM ? React.useLayoutEffect : React.useEffect;

// src/components/Provider.tsx
function Provider({
  store,
  context,
  children,
  serverState,
  stabilityCheck = "once",
  identityFunctionCheck = "once"
}) {
  const contextValue = React.useMemo(() => {
    const subscription = createSubscription(store);
    return {
      store,
      subscription,
      getServerState: serverState ? () => serverState : void 0,
      stabilityCheck,
      identityFunctionCheck
    };
  }, [store, serverState, stabilityCheck, identityFunctionCheck]);
  const previousState = React.useMemo(() => store.getState(), [store]);
  useIsomorphicLayoutEffect(() => {
    const { subscription } = contextValue;
    subscription.onStateChange = subscription.notifyNestedSubs;
    subscription.trySubscribe();
    if (previousState !== store.getState()) {
      subscription.notifyNestedSubs();
    }
    return () => {
      subscription.tryUnsubscribe();
      subscription.onStateChange = void 0;
    };
  }, [contextValue, previousState]);
  const Context = context || ReactReduxContext;
  return /* @__PURE__ */ React.createElement(Context.Provider, { value: contextValue }, children);
}
var Provider_default = Provider;

// src/hooks/useStore.ts
function createStoreHook(context = ReactReduxContext) {
  const useReduxContext2 = (
    // @ts-ignore
    context === ReactReduxContext ? useReduxContext : (
      // @ts-ignore
      createReduxContextHook(context)
    )
  );
  return function useStore2() {
    const { store } = useReduxContext2();
    return store;
  };
}
var useStore = /* @__PURE__ */ createStoreHook();

// src/hooks/useDispatch.ts
function createDispatchHook(context = ReactReduxContext) {
  const useStore2 = (
    // @ts-ignore
    context === ReactReduxContext ? useStore : createStoreHook(context)
  );
  return function useDispatch2() {
    const store = useStore2();
    return store.dispatch;
  };
}
var useDispatch = /* @__PURE__ */ createDispatchHook();

// src/index.ts
initializeUseSelector(useSyncExternalStoreWithSelector$1);

// src/utils/formatProdErrorMessage.ts
function formatProdErrorMessage(code) {
  return `Minified Redux error #${code}; visit https://redux.js.org/Errors?code=${code} for the full message or use the non-minified dev environment for full errors. `;
}

// src/utils/symbol-observable.ts
var $$observable = /* @__PURE__ */ (() => typeof Symbol === "function" && Symbol.observable || "@@observable")();
var symbol_observable_default = $$observable;

// src/utils/actionTypes.ts
var randomString = () => Math.random().toString(36).substring(7).split("").join(".");
var ActionTypes = {
  INIT: `@@redux/INIT${/* @__PURE__ */ randomString()}`,
  REPLACE: `@@redux/REPLACE${/* @__PURE__ */ randomString()}`,
  PROBE_UNKNOWN_ACTION: () => `@@redux/PROBE_UNKNOWN_ACTION${randomString()}`
};
var actionTypes_default = ActionTypes;

// src/utils/isPlainObject.ts
function isPlainObject(obj) {
  if (typeof obj !== "object" || obj === null)
    return false;
  let proto = obj;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return Object.getPrototypeOf(obj) === proto || Object.getPrototypeOf(obj) === null;
}

// src/createStore.ts
function createStore(reducer, preloadedState, enhancer) {
  if (typeof reducer !== "function") {
    throw new Error(formatProdErrorMessage(2) );
  }
  if (typeof preloadedState === "function" && typeof enhancer === "function" || typeof enhancer === "function" && typeof arguments[3] === "function") {
    throw new Error(formatProdErrorMessage(0) );
  }
  if (typeof preloadedState === "function" && typeof enhancer === "undefined") {
    enhancer = preloadedState;
    preloadedState = void 0;
  }
  if (typeof enhancer !== "undefined") {
    if (typeof enhancer !== "function") {
      throw new Error(formatProdErrorMessage(1) );
    }
    return enhancer(createStore)(reducer, preloadedState);
  }
  let currentReducer = reducer;
  let currentState = preloadedState;
  let currentListeners = /* @__PURE__ */ new Map();
  let nextListeners = currentListeners;
  let listenerIdCounter = 0;
  let isDispatching = false;
  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = /* @__PURE__ */ new Map();
      currentListeners.forEach((listener, key) => {
        nextListeners.set(key, listener);
      });
    }
  }
  function getState() {
    if (isDispatching) {
      throw new Error(formatProdErrorMessage(3) );
    }
    return currentState;
  }
  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new Error(formatProdErrorMessage(4) );
    }
    if (isDispatching) {
      throw new Error(formatProdErrorMessage(5) );
    }
    let isSubscribed = true;
    ensureCanMutateNextListeners();
    const listenerId = listenerIdCounter++;
    nextListeners.set(listenerId, listener);
    return function unsubscribe() {
      if (!isSubscribed) {
        return;
      }
      if (isDispatching) {
        throw new Error(formatProdErrorMessage(6) );
      }
      isSubscribed = false;
      ensureCanMutateNextListeners();
      nextListeners.delete(listenerId);
      currentListeners = null;
    };
  }
  function dispatch(action) {
    if (!isPlainObject(action)) {
      throw new Error(formatProdErrorMessage(7) );
    }
    if (typeof action.type === "undefined") {
      throw new Error(formatProdErrorMessage(8) );
    }
    if (typeof action.type !== "string") {
      throw new Error(formatProdErrorMessage(17) );
    }
    if (isDispatching) {
      throw new Error(formatProdErrorMessage(9) );
    }
    try {
      isDispatching = true;
      currentState = currentReducer(currentState, action);
    } finally {
      isDispatching = false;
    }
    const listeners = currentListeners = nextListeners;
    listeners.forEach((listener) => {
      listener();
    });
    return action;
  }
  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== "function") {
      throw new Error(formatProdErrorMessage(10) );
    }
    currentReducer = nextReducer;
    dispatch({
      type: actionTypes_default.REPLACE
    });
  }
  function observable() {
    const outerSubscribe = subscribe;
    return {
      /**
       * The minimal observable subscription method.
       * @param observer Any object that can be used as an observer.
       * The observer object should have a `next` method.
       * @returns An object with an `unsubscribe` method that can
       * be used to unsubscribe the observable from the store, and prevent further
       * emission of values from the observable.
       */
      subscribe(observer) {
        if (typeof observer !== "object" || observer === null) {
          throw new Error(formatProdErrorMessage(11) );
        }
        function observeState() {
          const observerAsObserver = observer;
          if (observerAsObserver.next) {
            observerAsObserver.next(getState());
          }
        }
        observeState();
        const unsubscribe = outerSubscribe(observeState);
        return {
          unsubscribe
        };
      },
      [symbol_observable_default]() {
        return this;
      }
    };
  }
  dispatch({
    type: actionTypes_default.INIT
  });
  const store = {
    dispatch,
    subscribe,
    getState,
    replaceReducer,
    [symbol_observable_default]: observable
  };
  return store;
}
function assertReducerShape(reducers) {
  Object.keys(reducers).forEach((key) => {
    const reducer = reducers[key];
    const initialState = reducer(void 0, {
      type: actionTypes_default.INIT
    });
    if (typeof initialState === "undefined") {
      throw new Error(formatProdErrorMessage(12) );
    }
    if (typeof reducer(void 0, {
      type: actionTypes_default.PROBE_UNKNOWN_ACTION()
    }) === "undefined") {
      throw new Error(formatProdErrorMessage(13) );
    }
  });
}
function combineReducers(reducers) {
  const reducerKeys = Object.keys(reducers);
  const finalReducers = {};
  for (let i = 0; i < reducerKeys.length; i++) {
    const key = reducerKeys[i];
    if (typeof reducers[key] === "function") {
      finalReducers[key] = reducers[key];
    }
  }
  const finalReducerKeys = Object.keys(finalReducers);
  let shapeAssertionError;
  try {
    assertReducerShape(finalReducers);
  } catch (e) {
    shapeAssertionError = e;
  }
  return function combination(state = {}, action) {
    if (shapeAssertionError) {
      throw shapeAssertionError;
    }
    let hasChanged = false;
    const nextState = {};
    for (let i = 0; i < finalReducerKeys.length; i++) {
      const key = finalReducerKeys[i];
      const reducer = finalReducers[key];
      const previousStateForKey = state[key];
      const nextStateForKey = reducer(previousStateForKey, action);
      if (typeof nextStateForKey === "undefined") {
        action && action.type;
        throw new Error(formatProdErrorMessage(14) );
      }
      nextState[key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }
    hasChanged = hasChanged || finalReducerKeys.length !== Object.keys(state).length;
    return hasChanged ? nextState : state;
  };
}

// src/compose.ts
function compose(...funcs) {
  if (funcs.length === 0) {
    return (arg) => arg;
  }
  if (funcs.length === 1) {
    return funcs[0];
  }
  return funcs.reduce((a, b) => (...args) => a(b(...args)));
}

var f$1=0;function u$1(e,t,n,o,i,u){var a,c,p={};for(c in t)"ref"==c?a=t[c]:p[c]=t[c];var l={type:e,props:p,key:n,ref:a,__k:null,__:null,__b:0,__e:null,__d:void 0,__c:null,constructor:void 0,__v:--f$1,__i:-1,__u:0,__source:i,__self:u};if("function"==typeof e&&(a=e.defaultProps))for(c in a)void 0===p[c]&&(p[c]=a[c]);return l$3.vnode&&l$3.vnode(l),l}

var t,r,u,i,o=0,f=[],c=[],e=l$3.__b,a=l$3.__r,v=l$3.diffed,l=l$3.__c,m=l$3.unmount;function d(t,u){l$3.__h&&l$3.__h(r,t,o||u),o=0;var i=r.__H||(r.__H={__:[],__h:[]});return t>=i.__.length&&i.__.push({__V:c}),i.__[t]}function p(u,i){var o=d(t++,3);!l$3.__s&&z(o.__H,i)&&(o.__=u,o.i=i,r.__H.__h.push(o));}function b(){for(var t;t=f.shift();)if(t.__P&&t.__H)try{t.__H.__h.forEach(k),t.__H.__h.forEach(w),t.__H.__h=[];}catch(r){t.__H.__h=[],l$3.__e(r,t.__v);}}l$3.__b=function(n){r=null,e&&e(n);},l$3.__r=function(n){a&&a(n),t=0;var i=(r=n.__c).__H;i&&(u===r?(i.__h=[],r.__h=[],i.__.forEach(function(n){n.__N&&(n.__=n.__N),n.__V=c,n.__N=n.i=void 0;})):(i.__h.forEach(k),i.__h.forEach(w),i.__h=[],t=0)),u=r;},l$3.diffed=function(t){v&&v(t);var o=t.__c;o&&o.__H&&(o.__H.__h.length&&(1!==f.push(o)&&i===l$3.requestAnimationFrame||((i=l$3.requestAnimationFrame)||j)(b)),o.__H.__.forEach(function(n){n.i&&(n.__H=n.i),n.__V!==c&&(n.__=n.__V),n.i=void 0,n.__V=c;})),u=r=null;},l$3.__c=function(t,r){r.some(function(t){try{t.__h.forEach(k),t.__h=t.__h.filter(function(n){return !n.__||w(n)});}catch(u){r.some(function(n){n.__h&&(n.__h=[]);}),r=[],l$3.__e(u,t.__v);}}),l&&l(t,r);},l$3.unmount=function(t){m&&m(t);var r,u=t.__c;u&&u.__H&&(u.__H.__.forEach(function(n){try{k(n);}catch(n){r=n;}}),u.__H=void 0,r&&l$3.__e(r,u.__v));};var g="function"==typeof requestAnimationFrame;function j(n){var t,r=function(){clearTimeout(u),g&&cancelAnimationFrame(t),setTimeout(n);},u=setTimeout(r,100);g&&(t=requestAnimationFrame(r));}function k(n){var t=r,u=n.__c;"function"==typeof u&&(n.__c=void 0,u()),r=t;}function w(n){var t=r;n.__c=n.__(),r=t;}function z(n,t){return !n||n.length!==t.length||t.some(function(t,r){return t!==n[r]})}

export { Provider_default, combineReducers, compose, createStore, p, q$4 as q, u$1 as u, useDispatch, useSelector };
