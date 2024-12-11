var n,l$1,u$2,i$1,r$1,o$1,e$1,f$2,c$1,s$1,a$1,h$1,p$1={},v$1=[],y$1=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,d$1=Array.isArray;function w$2(n,l){for(var u in l)n[u]=l[u];return n}function _$1(n){n&&n.parentNode&&n.parentNode.removeChild(n);}function g$2(l,u,t){var i,r,o,e={};for(o in u)"key"==o?i=u[o]:"ref"==o?r=u[o]:e[o]=u[o];if(arguments.length>2&&(e.children=arguments.length>3?n.call(arguments,2):t),"function"==typeof l&&null!=l.defaultProps)for(o in l.defaultProps)void 0===e[o]&&(e[o]=l.defaultProps[o]);return m$1(l,e,i,r,null)}function m$1(n,t,i,r,o){var e={type:n,props:t,key:i,ref:r,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:null==o?++u$2:o,__i:-1,__u:0};return null==o&&null!=l$1.vnode&&l$1.vnode(e),e}function b(){return {current:null}}function k$2(n){return n.children}function x$2(n,l){this.props=n,this.context=l;}function C$2(n,l){if(null==l)return n.__?C$2(n.__,n.__i+1):null;for(var u;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e)return u.__e;return "function"==typeof n.type?C$2(n):null}function S(n){var l,u;if(null!=(n=n.__)&&null!=n.__c){for(n.__e=n.__c.base=null,l=0;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e){n.__e=n.__c.base=u.__e;break}return S(n)}}function M$1(n){(!n.__d&&(n.__d=!0)&&i$1.push(n)&&!P$2.__r++||r$1!==l$1.debounceRendering)&&((r$1=l$1.debounceRendering)||o$1)(P$2);}function P$2(){var n,u,t,r,o,f,c,s;for(i$1.sort(e$1);n=i$1.shift();)n.__d&&(u=i$1.length,r=void 0,f=(o=(t=n).__v).__e,c=[],s=[],t.__P&&((r=w$2({},o)).__v=o.__v+1,l$1.vnode&&l$1.vnode(r),j$2(t.__P,r,o,t.__n,t.__P.namespaceURI,32&o.__u?[f]:null,c,null==f?C$2(o):f,!!(32&o.__u),s),r.__v=o.__v,r.__.__k[r.__i]=r,z$2(c,r,s),r.__e!=f&&S(r)),i$1.length>u&&i$1.sort(e$1));P$2.__r=0;}function $$1(n,l,u,t,i,r,o,e,f,c,s){var a,h,y,d,w,_,g=t&&t.__k||v$1,m=l.length;for(f=I$1(u,l,g,f),a=0;a<m;a++)null!=(y=u.__k[a])&&(h=-1===y.__i?p$1:g[y.__i]||p$1,y.__i=a,_=j$2(n,y,h,i,r,o,e,f,c,s),d=y.__e,y.ref&&h.ref!=y.ref&&(h.ref&&V$1(h.ref,null,y),s.push(y.ref,y.__c||d,y)),null==w&&null!=d&&(w=d),4&y.__u||h.__k===y.__k?f=H$1(y,f,n):"function"==typeof y.type&&void 0!==_?f=_:d&&(f=d.nextSibling),y.__u&=-7);return u.__e=w,f}function I$1(n,l,u,t){var i,r,o,e,f,c=l.length,s=u.length,a=s,h=0;for(n.__k=[],i=0;i<c;i++)null!=(r=l[i])&&"boolean"!=typeof r&&"function"!=typeof r?(e=i+h,(r=n.__k[i]="string"==typeof r||"number"==typeof r||"bigint"==typeof r||r.constructor==String?m$1(null,r,null,null,null):d$1(r)?m$1(k$2,{children:r},null,null,null):void 0===r.constructor&&r.__b>0?m$1(r.type,r.props,r.key,r.ref?r.ref:null,r.__v):r).__=n,r.__b=n.__b+1,o=null,-1!==(f=r.__i=T$2(r,u,e,a))&&(a--,(o=u[f])&&(o.__u|=2)),null==o||null===o.__v?(-1==f&&h--,"function"!=typeof r.type&&(r.__u|=4)):f!==e&&(f==e-1?h--:f==e+1?h++:(f>e?h--:h++,r.__u|=4))):r=n.__k[i]=null;if(a)for(i=0;i<s;i++)null!=(o=u[i])&&0==(2&o.__u)&&(o.__e==t&&(t=C$2(o)),q$2(o,o));return t}function H$1(n,l,u){var t,i;if("function"==typeof n.type){for(t=n.__k,i=0;t&&i<t.length;i++)t[i]&&(t[i].__=n,l=H$1(t[i],l,u));return l}n.__e!=l&&(l&&n.type&&!u.contains(l)&&(l=C$2(n)),u.insertBefore(n.__e,l||null),l=n.__e);do{l=l&&l.nextSibling;}while(null!=l&&8===l.nodeType);return l}function L$1(n,l){return l=l||[],null==n||"boolean"==typeof n||(d$1(n)?n.some(function(n){L$1(n,l);}):l.push(n)),l}function T$2(n,l,u,t){var i=n.key,r=n.type,o=u-1,e=u+1,f=l[u];if(null===f||f&&i==f.key&&r===f.type&&0==(2&f.__u))return u;if(("function"!=typeof r||r===k$2||i)&&t>(null!=f&&0==(2&f.__u)?1:0))for(;o>=0||e<l.length;){if(o>=0){if((f=l[o])&&0==(2&f.__u)&&i==f.key&&r===f.type)return o;o--;}if(e<l.length){if((f=l[e])&&0==(2&f.__u)&&i==f.key&&r===f.type)return e;e++;}}return -1}function A$2(n,l,u){"-"===l[0]?n.setProperty(l,null==u?"":u):n[l]=null==u?"":"number"!=typeof u||y$1.test(l)?u:u+"px";}function F$2(n,l,u,t,i){var r;n:if("style"===l)if("string"==typeof u)n.style.cssText=u;else {if("string"==typeof t&&(n.style.cssText=t=""),t)for(l in t)u&&l in u||A$2(n.style,l,"");if(u)for(l in u)t&&u[l]===t[l]||A$2(n.style,l,u[l]);}else if("o"===l[0]&&"n"===l[1])r=l!==(l=l.replace(f$2,"$1")),l=l.toLowerCase()in n||"onFocusOut"===l||"onFocusIn"===l?l.toLowerCase().slice(2):l.slice(2),n.l||(n.l={}),n.l[l+r]=u,u?t?u.u=t.u:(u.u=c$1,n.addEventListener(l,r?a$1:s$1,r)):n.removeEventListener(l,r?a$1:s$1,r);else {if("http://www.w3.org/2000/svg"==i)l=l.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if("width"!=l&&"height"!=l&&"href"!=l&&"list"!=l&&"form"!=l&&"tabIndex"!=l&&"download"!=l&&"rowSpan"!=l&&"colSpan"!=l&&"role"!=l&&"popover"!=l&&l in n)try{n[l]=null==u?"":u;break n}catch(n){}"function"==typeof u||(null==u||!1===u&&"-"!==l[4]?n.removeAttribute(l):n.setAttribute(l,"popover"==l&&1==u?"":u));}}function O$1(n){return function(u){if(this.l){var t=this.l[u.type+n];if(null==u.t)u.t=c$1++;else if(u.t<t.u)return;return t(l$1.event?l$1.event(u):u)}}}function j$2(n,u,t,i,r,o,e,f,c,s){var a,h,p,v,y,g,m,b,C,S,M,P,I,H,L,T,A,F=u.type;if(void 0!==u.constructor)return null;128&t.__u&&(c=!!(32&t.__u),o=[f=u.__e=t.__e]),(a=l$1.__b)&&a(u);n:if("function"==typeof F)try{if(b=u.props,C="prototype"in F&&F.prototype.render,S=(a=F.contextType)&&i[a.__c],M=a?S?S.props.value:a.__:i,t.__c?m=(h=u.__c=t.__c).__=h.__E:(C?u.__c=h=new F(b,M):(u.__c=h=new x$2(b,M),h.constructor=F,h.render=B$2),S&&S.sub(h),h.props=b,h.state||(h.state={}),h.context=M,h.__n=i,p=h.__d=!0,h.__h=[],h._sb=[]),C&&null==h.__s&&(h.__s=h.state),C&&null!=F.getDerivedStateFromProps&&(h.__s==h.state&&(h.__s=w$2({},h.__s)),w$2(h.__s,F.getDerivedStateFromProps(b,h.__s))),v=h.props,y=h.state,h.__v=u,p)C&&null==F.getDerivedStateFromProps&&null!=h.componentWillMount&&h.componentWillMount(),C&&null!=h.componentDidMount&&h.__h.push(h.componentDidMount);else {if(C&&null==F.getDerivedStateFromProps&&b!==v&&null!=h.componentWillReceiveProps&&h.componentWillReceiveProps(b,M),!h.__e&&(null!=h.shouldComponentUpdate&&!1===h.shouldComponentUpdate(b,h.__s,M)||u.__v===t.__v)){for(u.__v!==t.__v&&(h.props=b,h.state=h.__s,h.__d=!1),u.__e=t.__e,u.__k=t.__k,u.__k.some(function(n){n&&(n.__=u);}),P=0;P<h._sb.length;P++)h.__h.push(h._sb[P]);h._sb=[],h.__h.length&&e.push(h);break n}null!=h.componentWillUpdate&&h.componentWillUpdate(b,h.__s,M),C&&null!=h.componentDidUpdate&&h.__h.push(function(){h.componentDidUpdate(v,y,g);});}if(h.context=M,h.props=b,h.__P=n,h.__e=!1,I=l$1.__r,H=0,C){for(h.state=h.__s,h.__d=!1,I&&I(u),a=h.render(h.props,h.state,h.context),L=0;L<h._sb.length;L++)h.__h.push(h._sb[L]);h._sb=[];}else do{h.__d=!1,I&&I(u),a=h.render(h.props,h.state,h.context),h.state=h.__s;}while(h.__d&&++H<25);h.state=h.__s,null!=h.getChildContext&&(i=w$2(w$2({},i),h.getChildContext())),C&&!p&&null!=h.getSnapshotBeforeUpdate&&(g=h.getSnapshotBeforeUpdate(v,y)),f=$$1(n,d$1(T=null!=a&&a.type===k$2&&null==a.key?a.props.children:a)?T:[T],u,t,i,r,o,e,f,c,s),h.base=u.__e,u.__u&=-161,h.__h.length&&e.push(h),m&&(h.__E=h.__=null);}catch(n){if(u.__v=null,c||null!=o)if(n.then){for(u.__u|=c?160:128;f&&8===f.nodeType&&f.nextSibling;)f=f.nextSibling;o[o.indexOf(f)]=null,u.__e=f;}else for(A=o.length;A--;)_$1(o[A]);else u.__e=t.__e,u.__k=t.__k;l$1.__e(n,u,t);}else null==o&&u.__v===t.__v?(u.__k=t.__k,u.__e=t.__e):f=u.__e=N$1(t.__e,u,t,i,r,o,e,c,s);return (a=l$1.diffed)&&a(u),128&u.__u?void 0:f}function z$2(n,u,t){for(var i=0;i<t.length;i++)V$1(t[i],t[++i],t[++i]);l$1.__c&&l$1.__c(u,n),n.some(function(u){try{n=u.__h,u.__h=[],n.some(function(n){n.call(u);});}catch(n){l$1.__e(n,u.__v);}});}function N$1(u,t,i,r,o,e,f,c,s){var a,h,v,y,w,g,m,b=i.props,k=t.props,x=t.type;if("svg"===x?o="http://www.w3.org/2000/svg":"math"===x?o="http://www.w3.org/1998/Math/MathML":o||(o="http://www.w3.org/1999/xhtml"),null!=e)for(a=0;a<e.length;a++)if((w=e[a])&&"setAttribute"in w==!!x&&(x?w.localName===x:3===w.nodeType)){u=w,e[a]=null;break}if(null==u){if(null===x)return document.createTextNode(k);u=document.createElementNS(o,x,k.is&&k),c&&(l$1.__m&&l$1.__m(t,e),c=!1),e=null;}if(null===x)b===k||c&&u.data===k||(u.data=k);else {if(e=e&&n.call(u.childNodes),b=i.props||p$1,!c&&null!=e)for(b={},a=0;a<u.attributes.length;a++)b[(w=u.attributes[a]).name]=w.value;for(a in b)if(w=b[a],"children"==a);else if("dangerouslySetInnerHTML"==a)v=w;else if(!(a in k)){if("value"==a&&"defaultValue"in k||"checked"==a&&"defaultChecked"in k)continue;F$2(u,a,null,w,o);}for(a in k)w=k[a],"children"==a?y=w:"dangerouslySetInnerHTML"==a?h=w:"value"==a?g=w:"checked"==a?m=w:c&&"function"!=typeof w||b[a]===w||F$2(u,a,w,b[a],o);if(h)c||v&&(h.__html===v.__html||h.__html===u.innerHTML)||(u.innerHTML=h.__html),t.__k=[];else if(v&&(u.innerHTML=""),$$1(u,d$1(y)?y:[y],t,i,r,"foreignObject"===x?"http://www.w3.org/1999/xhtml":o,e,f,e?e[0]:i.__k&&C$2(i,0),c,s),null!=e)for(a=e.length;a--;)_$1(e[a]);c||(a="value","progress"===x&&null==g?u.removeAttribute("value"):void 0!==g&&(g!==u[a]||"progress"===x&&!g||"option"===x&&g!==b[a])&&F$2(u,a,g,b[a],o),a="checked",void 0!==m&&m!==u[a]&&F$2(u,a,m,b[a],o));}return u}function V$1(n,u,t){try{if("function"==typeof n){var i="function"==typeof n.__u;i&&n.__u(),i&&null==u||(n.__u=n(u));}else n.current=u;}catch(n){l$1.__e(n,t);}}function q$2(n,u,t){var i,r;if(l$1.unmount&&l$1.unmount(n),(i=n.ref)&&(i.current&&i.current!==n.__e||V$1(i,null,u)),null!=(i=n.__c)){if(i.componentWillUnmount)try{i.componentWillUnmount();}catch(n){l$1.__e(n,u);}i.base=i.__P=null;}if(i=n.__k)for(r=0;r<i.length;r++)i[r]&&q$2(i[r],u,t||"function"!=typeof n.type);t||_$1(n.__e),n.__c=n.__=n.__e=void 0;}function B$2(n,l,u){return this.constructor(n,u)}function D$2(u,t,i){var r,o,e,f;t===document&&(t=document.documentElement),l$1.__&&l$1.__(u,t),o=(r="function"==typeof i)?null:i&&i.__k||t.__k,e=[],f=[],j$2(t,u=(!r&&i||t).__k=g$2(k$2,null,[u]),o||p$1,p$1,t.namespaceURI,!r&&i?[i]:o?null:t.firstChild?n.call(t.childNodes):null,e,!r&&i?i:o?o.__e:t.firstChild,r,f),z$2(e,u,f);}function E$1(n,l){D$2(n,l,E$1);}function G$1(l,u,t){var i,r,o,e,f=w$2({},l.props);for(o in l.type&&l.type.defaultProps&&(e=l.type.defaultProps),u)"key"==o?i=u[o]:"ref"==o?r=u[o]:f[o]=void 0===u[o]&&void 0!==e?e[o]:u[o];return arguments.length>2&&(f.children=arguments.length>3?n.call(arguments,2):t),m$1(l.type,f,i||l.key,r||l.ref,null)}function J$1(n,l){var u={__c:l="__cC"+h$1++,__:n,Consumer:function(n,l){return n.children(l)},Provider:function(n){var u,t;return this.getChildContext||(u=new Set,(t={})[l]=this,this.getChildContext=function(){return t},this.componentWillUnmount=function(){u=null;},this.shouldComponentUpdate=function(n){this.props.value!==n.value&&u.forEach(function(n){n.__e=!0,M$1(n);});},this.sub=function(n){u.add(n);var l=n.componentWillUnmount;n.componentWillUnmount=function(){u&&u.delete(n),l&&l.call(n);};}),n.children}};return u.Provider.__=u.Consumer.contextType=u}n=v$1.slice,l$1={__e:function(n,l,u,t){for(var i,r,o;l=l.__;)if((i=l.__c)&&!i.__)try{if((r=i.constructor)&&null!=r.getDerivedStateFromError&&(i.setState(r.getDerivedStateFromError(n)),o=i.__d),null!=i.componentDidCatch&&(i.componentDidCatch(n,t||{}),o=i.__d),o)return i.__E=i}catch(l){n=l;}throw n}},u$2=0,x$2.prototype.setState=function(n,l){var u;u=null!=this.__s&&this.__s!==this.state?this.__s:this.__s=w$2({},this.state),"function"==typeof n&&(n=n(w$2({},u),this.props)),n&&w$2(u,n),null!=n&&this.__v&&(l&&this._sb.push(l),M$1(this));},x$2.prototype.forceUpdate=function(n){this.__v&&(this.__e=!0,n&&this.__h.push(n),M$1(this));},x$2.prototype.render=k$2,i$1=[],o$1="function"==typeof Promise?Promise.prototype.then.bind(Promise.resolve()):setTimeout,e$1=function(n,l){return n.__v.__b-l.__v.__b},P$2.__r=0,f$2=/(PointerCapture)$|Capture$/i,c$1=0,s$1=O$1(!1),a$1=O$1(!0),h$1=0;

var t,r,u$1,i,o=0,f$1=[],c=l$1,e=c.__b,a=c.__r,v=c.diffed,l=c.__c,m=c.unmount,s=c.__;function d(n,t){c.__h&&c.__h(r,n,o||t),o=0;var u=r.__H||(r.__H={__:[],__h:[]});return n>=u.__.length&&u.__.push({}),u.__[n]}function h(n){return o=1,p(D$1,n)}function p(n,u,i){var o=d(t++,2);if(o.t=n,!o.__c&&(o.__=[i?i(u):D$1(void 0,u),function(n){var t=o.__N?o.__N[0]:o.__[0],r=o.t(t,n);t!==r&&(o.__N=[r,o.__[1]],o.__c.setState({}));}],o.__c=r,!r.u)){var f=function(n,t,r){if(!o.__c.__H)return !0;var u=o.__c.__H.__.filter(function(n){return !!n.__c});if(u.every(function(n){return !n.__N}))return !c||c.call(this,n,t,r);var i=o.__c.props!==n;return u.forEach(function(n){if(n.__N){var t=n.__[0];n.__=n.__N,n.__N=void 0,t!==n.__[0]&&(i=!0);}}),c&&c.call(this,n,t,r)||i};r.u=!0;var c=r.shouldComponentUpdate,e=r.componentWillUpdate;r.componentWillUpdate=function(n,t,r){if(this.__e){var u=c;c=void 0,f(n,t,r),c=u;}e&&e.call(this,n,t,r);},r.shouldComponentUpdate=f;}return o.__N||o.__}function y(n,u){var i=d(t++,3);!c.__s&&C$1(i.__H,u)&&(i.__=n,i.i=u,r.__H.__h.push(i));}function _(n,u){var i=d(t++,4);!c.__s&&C$1(i.__H,u)&&(i.__=n,i.i=u,r.__h.push(i));}function A$1(n){return o=5,T$1(function(){return {current:n}},[])}function F$1(n,t,r){o=6,_(function(){return "function"==typeof n?(n(t()),function(){return n(null)}):n?(n.current=t(),function(){return n.current=null}):void 0},null==r?r:r.concat(n));}function T$1(n,r){var u=d(t++,7);return C$1(u.__H,r)&&(u.__=n(),u.__H=r,u.__h=n),u.__}function q$1(n,t){return o=8,T$1(function(){return n},t)}function x$1(n){var u=r.context[n.__c],i=d(t++,9);return i.c=n,u?(null==i.__&&(i.__=!0,u.sub(r)),u.props.value):n.__}function P$1(n,t){c.useDebugValue&&c.useDebugValue(t?t(n):n);}function g$1(){var n=d(t++,11);if(!n.__){for(var u=r.__v;null!==u&&!u.__m&&null!==u.__;)u=u.__;var i=u.__m||(u.__m=[0,0]);n.__="P"+i[0]+"-"+i[1]++;}return n.__}function j$1(){for(var n;n=f$1.shift();)if(n.__P&&n.__H)try{n.__H.__h.forEach(z$1),n.__H.__h.forEach(B$1),n.__H.__h=[];}catch(t){n.__H.__h=[],c.__e(t,n.__v);}}c.__b=function(n){r=null,e&&e(n);},c.__=function(n,t){n&&t.__k&&t.__k.__m&&(n.__m=t.__k.__m),s&&s(n,t);},c.__r=function(n){a&&a(n),t=0;var i=(r=n.__c).__H;i&&(u$1===r?(i.__h=[],r.__h=[],i.__.forEach(function(n){n.__N&&(n.__=n.__N),n.i=n.__N=void 0;})):(i.__h.forEach(z$1),i.__h.forEach(B$1),i.__h=[],t=0)),u$1=r;},c.diffed=function(n){v&&v(n);var t=n.__c;t&&t.__H&&(t.__H.__h.length&&(1!==f$1.push(t)&&i===c.requestAnimationFrame||((i=c.requestAnimationFrame)||w$1)(j$1)),t.__H.__.forEach(function(n){n.i&&(n.__H=n.i),n.i=void 0;})),u$1=r=null;},c.__c=function(n,t){t.some(function(n){try{n.__h.forEach(z$1),n.__h=n.__h.filter(function(n){return !n.__||B$1(n)});}catch(r){t.some(function(n){n.__h&&(n.__h=[]);}),t=[],c.__e(r,n.__v);}}),l&&l(n,t);},c.unmount=function(n){m&&m(n);var t,r=n.__c;r&&r.__H&&(r.__H.__.forEach(function(n){try{z$1(n);}catch(n){t=n;}}),r.__H=void 0,t&&c.__e(t,r.__v));};var k$1="function"==typeof requestAnimationFrame;function w$1(n){var t,r=function(){clearTimeout(u),k$1&&cancelAnimationFrame(t),setTimeout(n);},u=setTimeout(r,100);k$1&&(t=requestAnimationFrame(r));}function z$1(n){var t=r,u=n.__c;"function"==typeof u&&(n.__c=void 0,u()),r=t;}function B$1(n){var t=r;n.__c=n.__(),r=t;}function C$1(n,t){return !n||n.length!==t.length||t.some(function(t,r){return t!==n[r]})}function D$1(n,t){return "function"==typeof t?t(n):t}

function g(n,t){for(var e in n)if("__source"!==e&&!(e in t))return !0;for(var r in t)if("__source"!==r&&n[r]!==t[r])return !0;return !1}function E(n,t){var e=t(),r=h({t:{__:e,u:t}}),u=r[0].t,o=r[1];return _(function(){u.__=e,u.u=t,C(u)&&o({t:u});},[n,e,t]),y(function(){return C(u)&&o({t:u}),n(function(){C(u)&&o({t:u});})},[n]),e}function C(n){var t,e,r=n.u,u=n.__;try{var o=r();return !((t=u)===(e=o)&&(0!==t||1/t==1/e)||t!=t&&e!=e)}catch(n){return !0}}function x(n){n();}function R(n){return n}function w(){return [!1,x]}var k=_;function I(n,t){this.props=n,this.context=t;}function N(n,e){function r(n){var t=this.props.ref,r=t==n.ref;return !r&&t&&(t.call?t(null):t.current=null),e?!e(this.props,n)||!r:g(this.props,n)}function u(e){return this.shouldComponentUpdate=r,g$2(n,e)}return u.displayName="Memo("+(n.displayName||n.name)+")",u.prototype.isReactComponent=!0,u.__f=!0,u}(I.prototype=new x$2).isPureReactComponent=!0,I.prototype.shouldComponentUpdate=function(n,t){return g(this.props,n)||g(this.state,t)};var M=l$1.__b;l$1.__b=function(n){n.type&&n.type.__f&&n.ref&&(n.props.ref=n.ref,n.ref=null),M&&M(n);};var T="undefined"!=typeof Symbol&&Symbol.for&&Symbol.for("react.forward_ref")||3911;function A(n){function t(t){if(!("ref"in t))return n(t,null);var e=t.ref;delete t.ref;var r=n(t,e);return t.ref=e,r}return t.$$typeof=T,t.render=t,t.prototype.isReactComponent=t.__f=!0,t.displayName="ForwardRef("+(n.displayName||n.name)+")",t}var D=function(n,t){return null==n?null:L$1(L$1(n).map(t))},L={map:D,forEach:D,count:function(n){return n?L$1(n).length:0},only:function(n){var t=L$1(n);if(1!==t.length)throw "Children.only";return t[0]},toArray:L$1},O=l$1.__e;l$1.__e=function(n,t,e,r){if(n.then)for(var u,o=t;o=o.__;)if((u=o.__c)&&u.__c)return null==t.__e&&(t.__e=e.__e,t.__k=e.__k),u.__c(n,t);O(n,t,e,r);};var F=l$1.unmount;function U(n,t,e){return n&&(n.__c&&n.__c.__H&&(n.__c.__H.__.forEach(function(n){"function"==typeof n.__c&&n.__c();}),n.__c.__H=null),null!=(n=function(n,t){for(var e in t)n[e]=t[e];return n}({},n)).__c&&(n.__c.__P===e&&(n.__c.__P=t),n.__c=null),n.__k=n.__k&&n.__k.map(function(n){return U(n,t,e)})),n}function V(n,t,e){return n&&e&&(n.__v=null,n.__k=n.__k&&n.__k.map(function(n){return V(n,t,e)}),n.__c&&n.__c.__P===t&&(n.__e&&e.appendChild(n.__e),n.__c.__e=!0,n.__c.__P=e)),n}function W(){this.__u=0,this.o=null,this.__b=null;}function P(n){var t=n.__.__c;return t&&t.__a&&t.__a(n)}function j(n){var e,r,u;function o(o){if(e||(e=n()).then(function(n){r=n.default||n;},function(n){u=n;}),u)throw u;if(!r)throw e;return g$2(r,o)}return o.displayName="Lazy",o.__f=!0,o}function z(){this.i=null,this.l=null;}l$1.unmount=function(n){var t=n.__c;t&&t.__R&&t.__R(),t&&32&n.__u&&(n.type=null),F&&F(n);},(W.prototype=new x$2).__c=function(n,t){var e=t.__c,r=this;null==r.o&&(r.o=[]),r.o.push(e);var u=P(r.__v),o=!1,i=function(){o||(o=!0,e.__R=null,u?u(c):c());};e.__R=i;var c=function(){if(!--r.__u){if(r.state.__a){var n=r.state.__a;r.__v.__k[0]=V(n,n.__c.__P,n.__c.__O);}var t;for(r.setState({__a:r.__b=null});t=r.o.pop();)t.forceUpdate();}};r.__u++||32&t.__u||r.setState({__a:r.__b=r.__v.__k[0]}),n.then(i,i);},W.prototype.componentWillUnmount=function(){this.o=[];},W.prototype.render=function(n,e){if(this.__b){if(this.__v.__k){var r=document.createElement("div"),o=this.__v.__k[0].__c;this.__v.__k[0]=U(this.__b,r,o.__O=o.__P);}this.__b=null;}var i=e.__a&&g$2(k$2,null,n.fallback);return i&&(i.__u&=-33),[g$2(k$2,null,e.__a?null:n.children),i]};var B=function(n,t,e){if(++e[1]===e[0]&&n.l.delete(t),n.props.revealOrder&&("t"!==n.props.revealOrder[0]||!n.l.size))for(e=n.i;e;){for(;e.length>3;)e.pop()();if(e[1]<e[0])break;n.i=e=e[2];}};function H(n){return this.getChildContext=function(){return n.context},n.children}function Z(n){var e=this,r=n.h;e.componentWillUnmount=function(){D$2(null,e.v),e.v=null,e.h=null;},e.h&&e.h!==r&&e.componentWillUnmount(),e.v||(e.h=r,e.v={nodeType:1,parentNode:r,childNodes:[],contains:function(){return !0},appendChild:function(n){this.childNodes.push(n),e.h.appendChild(n);},insertBefore:function(n,t){this.childNodes.push(n),e.h.insertBefore(n,t);},removeChild:function(n){this.childNodes.splice(this.childNodes.indexOf(n)>>>1,1),e.h.removeChild(n);}}),D$2(g$2(H,{context:e.context},n.__v),e.v);}function Y(n,e){var r=g$2(Z,{__v:n,h:e});return r.containerInfo=e,r}(z.prototype=new x$2).__a=function(n){var t=this,e=P(t.__v),r=t.l.get(n);return r[0]++,function(u){var o=function(){t.props.revealOrder?(r.push(u),B(t,n,r)):u();};e?e(o):o();}},z.prototype.render=function(n){this.i=null,this.l=new Map;var t=L$1(n.children);n.revealOrder&&"b"===n.revealOrder[0]&&t.reverse();for(var e=t.length;e--;)this.l.set(t[e],this.i=[1,0,this.i]);return n.children},z.prototype.componentDidUpdate=z.prototype.componentDidMount=function(){var n=this;this.l.forEach(function(t,e){B(n,e,t);});};var $="undefined"!=typeof Symbol&&Symbol.for&&Symbol.for("react.element")||60103,q=/^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/,G=/^on(Ani|Tra|Tou|BeforeInp|Compo)/,J=/[A-Z0-9]/g,K="undefined"!=typeof document,Q=function(n){return ("undefined"!=typeof Symbol&&"symbol"==typeof Symbol()?/fil|che|rad/:/fil|che|ra/).test(n)};function X(n,t,e){return null==t.__k&&(t.textContent=""),D$2(n,t),"function"==typeof e&&e(),n?n.__c:null}function nn(n,t,e){return E$1(n,t),"function"==typeof e&&e(),n?n.__c:null}x$2.prototype.isReactComponent={},["componentWillMount","componentWillReceiveProps","componentWillUpdate"].forEach(function(t){Object.defineProperty(x$2.prototype,t,{configurable:!0,get:function(){return this["UNSAFE_"+t]},set:function(n){Object.defineProperty(this,t,{configurable:!0,writable:!0,value:n});}});});var tn=l$1.event;function en(){}function rn(){return this.cancelBubble}function un(){return this.defaultPrevented}l$1.event=function(n){return tn&&(n=tn(n)),n.persist=en,n.isPropagationStopped=rn,n.isDefaultPrevented=un,n.nativeEvent=n};var on,cn={enumerable:!1,configurable:!0,get:function(){return this.class}},fn=l$1.vnode;l$1.vnode=function(n){"string"==typeof n.type&&function(n){var t=n.props,e=n.type,u={},o=-1===e.indexOf("-");for(var i in t){var c=t[i];if(!("value"===i&&"defaultValue"in t&&null==c||K&&"children"===i&&"noscript"===e||"class"===i||"className"===i)){var f=i.toLowerCase();"defaultValue"===i&&"value"in t&&null==t.value?i="value":"download"===i&&!0===c?c="":"translate"===f&&"no"===c?c=!1:"o"===f[0]&&"n"===f[1]?"ondoubleclick"===f?i="ondblclick":"onchange"!==f||"input"!==e&&"textarea"!==e||Q(t.type)?"onfocus"===f?i="onfocusin":"onblur"===f?i="onfocusout":G.test(i)&&(i=f):f=i="oninput":o&&q.test(i)?i=i.replace(J,"-$&").toLowerCase():null===c&&(c=void 0),"oninput"===f&&u[i=f]&&(i="oninputCapture"),u[i]=c;}}"select"==e&&u.multiple&&Array.isArray(u.value)&&(u.value=L$1(t.children).forEach(function(n){n.props.selected=-1!=u.value.indexOf(n.props.value);})),"select"==e&&null!=u.defaultValue&&(u.value=L$1(t.children).forEach(function(n){n.props.selected=u.multiple?-1!=u.defaultValue.indexOf(n.props.value):u.defaultValue==n.props.value;})),t.class&&!t.className?(u.class=t.class,Object.defineProperty(u,"className",cn)):(t.className&&!t.class||t.class&&t.className)&&(u.class=u.className=t.className),n.props=u;}(n),n.$$typeof=$,fn&&fn(n);};var ln=l$1.__r;l$1.__r=function(n){ln&&ln(n),on=n.__c;};var an=l$1.diffed;l$1.diffed=function(n){an&&an(n);var t=n.props,e=n.__e;null!=e&&"textarea"===n.type&&"value"in t&&t.value!==e.value&&(e.value=null==t.value?"":t.value),on=null;};var sn={ReactCurrentDispatcher:{current:{readContext:function(n){return on.__n[n.__c].props.value},useCallback:q$1,useContext:x$1,useDebugValue:P$1,useDeferredValue:R,useEffect:y,useId:g$1,useImperativeHandle:F$1,useInsertionEffect:k,useLayoutEffect:_,useMemo:T$1,useReducer:p,useRef:A$1,useState:h,useSyncExternalStore:E,useTransition:w}}};function vn(n){return g$2.bind(null,n)}function dn(n){return !!n&&n.$$typeof===$}function pn(n){return dn(n)&&n.type===k$2}function mn(n){return !!n&&!!n.displayName&&("string"==typeof n.displayName||n.displayName instanceof String)&&n.displayName.startsWith("Memo(")}function yn(n){return dn(n)?G$1.apply(null,arguments):n}function _n(n){return !!n.__k&&(D$2(null,n),!0)}function bn(n){return n&&(n.base||1===n.nodeType&&n)||null}var Sn=function(n,t){return n(t)},gn=function(n,t){return n(t)},En=k$2,Cn=dn,xn={useState:h,useId:g$1,useReducer:p,useEffect:y,useLayoutEffect:_,useInsertionEffect:k,useTransition:w,useDeferredValue:R,useSyncExternalStore:E,startTransition:x,useRef:A$1,useImperativeHandle:F$1,useMemo:T$1,useCallback:q$1,useContext:x$1,useDebugValue:P$1,version:"18.3.1",Children:L,render:X,hydrate:nn,unmountComponentAtNode:_n,createPortal:Y,createElement:g$2,createContext:J$1,createFactory:vn,cloneElement:yn,createRef:b,Fragment:k$2,isValidElement:dn,isElement:Cn,isFragment:pn,isMemo:mn,findDOMNode:bn,Component:x$2,PureComponent:I,memo:N,forwardRef:A,flushSync:gn,unstable_batchedUpdates:Sn,StrictMode:En,Suspense:W,SuspenseList:z,lazy:j,__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED:sn};

var withSelector = {exports: {}};

var useSyncExternalStoreWithSelector_production = {};

/**
 * @license React
 * use-sync-external-store-with-selector.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var hasRequiredUseSyncExternalStoreWithSelector_production;

function requireUseSyncExternalStoreWithSelector_production () {
	if (hasRequiredUseSyncExternalStoreWithSelector_production) return useSyncExternalStoreWithSelector_production;
	hasRequiredUseSyncExternalStoreWithSelector_production = 1;
	var React = xn;
	function is(x, y) {
	  return (x === y && (0 !== x || 1 / x === 1 / y)) || (x !== x && y !== y);
	}
	var objectIs = "function" === typeof Object.is ? Object.is : is,
	  useSyncExternalStore = React.useSyncExternalStore,
	  useRef = React.useRef,
	  useEffect = React.useEffect,
	  useMemo = React.useMemo,
	  useDebugValue = React.useDebugValue;
	useSyncExternalStoreWithSelector_production.useSyncExternalStoreWithSelector = function (
	  subscribe,
	  getSnapshot,
	  getServerSnapshot,
	  selector,
	  isEqual
	) {
	  var instRef = useRef(null);
	  if (null === instRef.current) {
	    var inst = { hasValue: !1, value: null };
	    instRef.current = inst;
	  } else inst = instRef.current;
	  instRef = useMemo(
	    function () {
	      function memoizedSelector(nextSnapshot) {
	        if (!hasMemo) {
	          hasMemo = !0;
	          memoizedSnapshot = nextSnapshot;
	          nextSnapshot = selector(nextSnapshot);
	          if (void 0 !== isEqual && inst.hasValue) {
	            var currentSelection = inst.value;
	            if (isEqual(currentSelection, nextSnapshot))
	              return (memoizedSelection = currentSelection);
	          }
	          return (memoizedSelection = nextSnapshot);
	        }
	        currentSelection = memoizedSelection;
	        if (objectIs(memoizedSnapshot, nextSnapshot)) return currentSelection;
	        var nextSelection = selector(nextSnapshot);
	        if (void 0 !== isEqual && isEqual(currentSelection, nextSelection))
	          return (memoizedSnapshot = nextSnapshot), currentSelection;
	        memoizedSnapshot = nextSnapshot;
	        return (memoizedSelection = nextSelection);
	      }
	      var hasMemo = !1,
	        memoizedSnapshot,
	        memoizedSelection,
	        maybeGetServerSnapshot =
	          void 0 === getServerSnapshot ? null : getServerSnapshot;
	      return [
	        function () {
	          return memoizedSelector(getSnapshot());
	        },
	        null === maybeGetServerSnapshot
	          ? void 0
	          : function () {
	              return memoizedSelector(maybeGetServerSnapshot());
	            }
	      ];
	    },
	    [getSnapshot, getServerSnapshot, selector, isEqual]
	  );
	  var value = useSyncExternalStore(subscribe, instRef[0], instRef[1]);
	  useEffect(
	    function () {
	      inst.hasValue = !0;
	      inst.value = value;
	    },
	    [value]
	  );
	  useDebugValue(value);
	  return value;
	};
	return useSyncExternalStoreWithSelector_production;
}

var hasRequiredWithSelector;

function requireWithSelector () {
	if (hasRequiredWithSelector) return withSelector.exports;
	hasRequiredWithSelector = 1;

	{
	  withSelector.exports = requireUseSyncExternalStoreWithSelector_production();
	}
	return withSelector.exports;
}

var withSelectorExports = requireWithSelector();

var useSyncExternalStoreWithSelector = withSelectorExports.useSyncExternalStoreWithSelector;

// src/utils/react.ts

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
      const listeners = [];
      let listener = first;
      while (listener) {
        listeners.push(listener);
        listener = listener.next;
      }
      return listeners;
    },
    subscribe(callback) {
      let isSubscribed = true;
      const listener = last = {
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
        if (!isSubscribed || first === null) return;
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
      unsubscribe = store.subscribe(handleChangeWrapper);
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
var canUseDOM = () => !!(typeof window !== "undefined" && typeof window.document !== "undefined" && typeof window.document.createElement !== "undefined");
var isDOM = /* @__PURE__ */ canUseDOM();
var isRunningInReactNative = () => typeof navigator !== "undefined" && navigator.product === "ReactNative";
var isReactNative = /* @__PURE__ */ isRunningInReactNative();
var getUseIsomorphicLayoutEffect = () => isDOM || isReactNative ? _ : y;
var useIsomorphicLayoutEffect = /* @__PURE__ */ getUseIsomorphicLayoutEffect();

// src/components/Context.ts
var ContextKey = /* @__PURE__ */ Symbol.for(`react-redux-context`);
var gT = typeof globalThis !== "undefined" ? globalThis : (
  /* fall back to a per-module scope (pre-8.1 behaviour) if `globalThis` is not available */
  {}
);
function getContext() {
  if (!J$1) return {};
  const contextMap = gT[ContextKey] ??= /* @__PURE__ */ new Map();
  let realContext = contextMap.get(J$1);
  if (!realContext) {
    realContext = J$1(
      null
    );
    contextMap.set(J$1, realContext);
  }
  return realContext;
}
var ReactReduxContext = /* @__PURE__ */ getContext();

// src/components/Provider.tsx
function Provider(providerProps) {
  const { children, context, serverState, store } = providerProps;
  const contextValue = T$1(() => {
    const subscription = createSubscription(store);
    const baseContextValue = {
      store,
      subscription,
      getServerState: serverState ? () => serverState : void 0
    };
    {
      return baseContextValue;
    }
  }, [store, serverState]);
  const previousState = T$1(() => store.getState(), [store]);
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
  return /* @__PURE__ */ g$2(Context.Provider, { value: contextValue }, children);
}
var Provider_default = Provider;

// src/hooks/useReduxContext.ts
function createReduxContextHook(context = ReactReduxContext) {
  return function useReduxContext2() {
    const contextValue = x$1(context);
    return contextValue;
  };
}
var useReduxContext = /* @__PURE__ */ createReduxContextHook();

// src/hooks/useStore.ts
function createStoreHook(context = ReactReduxContext) {
  const useReduxContext2 = context === ReactReduxContext ? useReduxContext : (
    // @ts-ignore
    createReduxContextHook(context)
  );
  const useStore2 = () => {
    const { store } = useReduxContext2();
    return store;
  };
  Object.assign(useStore2, {
    withTypes: () => useStore2
  });
  return useStore2;
}
var useStore = /* @__PURE__ */ createStoreHook();

// src/hooks/useDispatch.ts
function createDispatchHook(context = ReactReduxContext) {
  const useStore2 = context === ReactReduxContext ? useStore : createStoreHook(context);
  const useDispatch2 = () => {
    const store = useStore2();
    return store.dispatch;
  };
  Object.assign(useDispatch2, {
    withTypes: () => useDispatch2
  });
  return useDispatch2;
}
var useDispatch = /* @__PURE__ */ createDispatchHook();
var refEquality = (a, b) => a === b;
function createSelectorHook(context = ReactReduxContext) {
  const useReduxContext2 = context === ReactReduxContext ? useReduxContext : createReduxContextHook(context);
  const useSelector2 = (selector, equalityFnOrOptions = {}) => {
    const { equalityFn = refEquality } = typeof equalityFnOrOptions === "function" ? { equalityFn: equalityFnOrOptions } : equalityFnOrOptions;
    const reduxContext = useReduxContext2();
    const { store, subscription, getServerState } = reduxContext;
    A$1(true);
    const wrappedSelector = q$1(
      {
        [selector.name](state) {
          const selected = selector(state);
          return selected;
        }
      }[selector.name],
      [selector]
    );
    const selectedState = useSyncExternalStoreWithSelector(
      subscription.addNestedSub,
      store.getState,
      getServerState || store.getState,
      wrappedSelector,
      equalityFn
    );
    P$1(selectedState);
    return selectedState;
  };
  Object.assign(useSelector2, {
    withTypes: () => useSelector2
  });
  return useSelector2;
}
var useSelector = /* @__PURE__ */ createSelectorHook();

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

var f=0;function u(e,t,n,o,i,u){t||(t={});var a,c,l=t;"ref"in t&&(a=t.ref,delete t.ref);var p={type:e,props:l,key:n,ref:a,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:--f,__i:-1,__u:0,__source:i,__self:u};if("function"==typeof e&&(a=e.defaultProps))for(c in a)void 0===l[c]&&(l[c]=a[c]);return l$1.vnode&&l$1.vnode(p),p}

export { D$2 as D, Provider_default, combineReducers, compose, createStore, u, useDispatch, useSelector, y };
