var n,l$1,u$2,i$1,r$1,o$1,e$1,f$2,c$1,s$1,a$1,p$1={},v$1=[],y$1=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,d$1=Array.isArray;function w$1(n,l){for(var u in l)n[u]=l[u];return n}function _$1(n){n&&n.parentNode&&n.parentNode.removeChild(n);}function g$1(l,u,t){var i,r,o,e={};for(o in u)"key"==o?i=u[o]:"ref"==o?r=u[o]:e[o]=u[o];if(arguments.length>2&&(e.children=arguments.length>3?n.call(arguments,2):t),"function"==typeof l&&null!=l.defaultProps)for(o in l.defaultProps) undefined===e[o]&&(e[o]=l.defaultProps[o]);return m$1(l,e,i,r,null)}function m$1(n,t,i,r,o){var e={type:n,props:t,key:i,ref:r,__k:null,__:null,__b:0,__e:null,__c:null,constructor:undefined,__v:null==o?++u$2:o,__i:-1,__u:0};return null==o&&null!=l$1.vnode&&l$1.vnode(e),e}function k$1(n){return n.children}function x$1(n,l){this.props=n,this.context=l;}function C$2(n,l){if(null==l)return n.__?C$2(n.__,n.__i+1):null;for(var u;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e)return u.__e;return "function"==typeof n.type?C$2(n):null}function S(n){var l,u;if(null!=(n=n.__)&&null!=n.__c){for(n.__e=n.__c.base=null,l=0;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e){n.__e=n.__c.base=u.__e;break}return S(n)}}function M(n){(!n.__d&&(n.__d=true)&&i$1.push(n)&&!P$1.__r++||r$1!==l$1.debounceRendering)&&((r$1=l$1.debounceRendering)||o$1)(P$1);}function P$1(){var n,u,t,r,o,f,c,s;for(i$1.sort(e$1);n=i$1.shift();)n.__d&&(u=i$1.length,r=undefined,f=(o=(t=n).__v).__e,c=[],s=[],t.__P&&((r=w$1({},o)).__v=o.__v+1,l$1.vnode&&l$1.vnode(r),j$2(t.__P,r,o,t.__n,t.__P.namespaceURI,32&o.__u?[f]:null,c,null==f?C$2(o):f,!!(32&o.__u),s),r.__v=o.__v,r.__.__k[r.__i]=r,z$1(c,r,s),r.__e!=f&&S(r)),i$1.length>u&&i$1.sort(e$1));P$1.__r=0;}function $(n,l,u,t,i,r,o,e,f,c,s){var a,h,y,d,w,_,g=t&&t.__k||v$1,m=l.length;for(f=I(u,l,g,f,m),a=0;a<m;a++)null!=(y=u.__k[a])&&(h=-1===y.__i?p$1:g[y.__i]||p$1,y.__i=a,_=j$2(n,y,h,i,r,o,e,f,c,s),d=y.__e,y.ref&&h.ref!=y.ref&&(h.ref&&V$1(h.ref,null,y),s.push(y.ref,y.__c||d,y)),null==w&&null!=d&&(w=d),4&y.__u||h.__k===y.__k?f=A(y,f,n):"function"==typeof y.type&&undefined!==_?f=_:d&&(f=d.nextSibling),y.__u&=-7);return u.__e=w,f}function I(n,l,u,t,i){var r,o,e,f,c,s=u.length,a=s,h=0;for(n.__k=new Array(i),r=0;r<i;r++)null!=(o=l[r])&&"boolean"!=typeof o&&"function"!=typeof o?(f=r+h,(o=n.__k[r]="string"==typeof o||"number"==typeof o||"bigint"==typeof o||o.constructor==String?m$1(null,o,null,null,null):d$1(o)?m$1(k$1,{children:o},null,null,null):undefined===o.constructor&&o.__b>0?m$1(o.type,o.props,o.key,o.ref?o.ref:null,o.__v):o).__=n,o.__b=n.__b+1,e=null,-1!==(c=o.__i=L(o,u,f,a))&&(a--,(e=u[c])&&(e.__u|=2)),null==e||null===e.__v?(-1==c&&h--,"function"!=typeof o.type&&(o.__u|=4)):c!=f&&(c==f-1?h--:c==f+1?h++:(c>f?h--:h++,o.__u|=4))):n.__k[r]=null;if(a)for(r=0;r<s;r++)null!=(e=u[r])&&0==(2&e.__u)&&(e.__e==t&&(t=C$2(e)),q$1(e,e));return t}function A(n,l,u){var t,i;if("function"==typeof n.type){for(t=n.__k,i=0;t&&i<t.length;i++)t[i]&&(t[i].__=n,l=A(t[i],l,u));return l}n.__e!=l&&(l&&n.type&&!u.contains(l)&&(l=C$2(n)),u.insertBefore(n.__e,l||null),l=n.__e);do{l=l&&l.nextSibling;}while(null!=l&&8==l.nodeType);return l}function H$1(n,l){return l=l||[],null==n||"boolean"==typeof n||(d$1(n)?n.some(function(n){H$1(n,l);}):l.push(n)),l}function L(n,l,u,t){var i,r,o=n.key,e=n.type,f=l[u];if(null===f||f&&o==f.key&&e===f.type&&0==(2&f.__u))return u;if(t>(null!=f&&0==(2&f.__u)?1:0))for(i=u-1,r=u+1;i>=0||r<l.length;){if(i>=0){if((f=l[i])&&0==(2&f.__u)&&o==f.key&&e===f.type)return i;i--;}if(r<l.length){if((f=l[r])&&0==(2&f.__u)&&o==f.key&&e===f.type)return r;r++;}}return  -1}function T$1(n,l,u){"-"==l[0]?n.setProperty(l,null==u?"":u):n[l]=null==u?"":"number"!=typeof u||y$1.test(l)?u:u+"px";}function F$1(n,l,u,t,i){var r;n:if("style"==l)if("string"==typeof u)n.style.cssText=u;else {if("string"==typeof t&&(n.style.cssText=t=""),t)for(l in t)u&&l in u||T$1(n.style,l,"");if(u)for(l in u)t&&u[l]===t[l]||T$1(n.style,l,u[l]);}else if("o"==l[0]&&"n"==l[1])r=l!=(l=l.replace(f$2,"$1")),l=l.toLowerCase()in n||"onFocusOut"==l||"onFocusIn"==l?l.toLowerCase().slice(2):l.slice(2),n.l||(n.l={}),n.l[l+r]=u,u?t?u.u=t.u:(u.u=c$1,n.addEventListener(l,r?a$1:s$1,r)):n.removeEventListener(l,r?a$1:s$1,r);else {if("http://www.w3.org/2000/svg"==i)l=l.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if("width"!=l&&"height"!=l&&"href"!=l&&"list"!=l&&"form"!=l&&"tabIndex"!=l&&"download"!=l&&"rowSpan"!=l&&"colSpan"!=l&&"role"!=l&&"popover"!=l&&l in n)try{n[l]=null==u?"":u;break n}catch(n){}"function"==typeof u||(null==u||false===u&&"-"!=l[4]?n.removeAttribute(l):n.setAttribute(l,"popover"==l&&1==u?"":u));}}function O(n){return function(u){if(this.l){var t=this.l[u.type+n];if(null==u.t)u.t=c$1++;else if(u.t<t.u)return;return t(l$1.event?l$1.event(u):u)}}}function j$2(n,u,t,i,r,o,e,f,c,s){var a,h,p,v,y,g,m,b,C,S,M,P,I,A,H,L,T,F=u.type;if(undefined!==u.constructor)return null;128&t.__u&&(c=!!(32&t.__u),o=[f=u.__e=t.__e]),(a=l$1.__b)&&a(u);n:if("function"==typeof F)try{if(b=u.props,C="prototype"in F&&F.prototype.render,S=(a=F.contextType)&&i[a.__c],M=a?S?S.props.value:a.__:i,t.__c?m=(h=u.__c=t.__c).__=h.__E:(C?u.__c=h=new F(b,M):(u.__c=h=new x$1(b,M),h.constructor=F,h.render=B$2),S&&S.sub(h),h.props=b,h.state||(h.state={}),h.context=M,h.__n=i,p=h.__d=!0,h.__h=[],h._sb=[]),C&&null==h.__s&&(h.__s=h.state),C&&null!=F.getDerivedStateFromProps&&(h.__s==h.state&&(h.__s=w$1({},h.__s)),w$1(h.__s,F.getDerivedStateFromProps(b,h.__s))),v=h.props,y=h.state,h.__v=u,p)C&&null==F.getDerivedStateFromProps&&null!=h.componentWillMount&&h.componentWillMount(),C&&null!=h.componentDidMount&&h.__h.push(h.componentDidMount);else {if(C&&null==F.getDerivedStateFromProps&&b!==v&&null!=h.componentWillReceiveProps&&h.componentWillReceiveProps(b,M),!h.__e&&(null!=h.shouldComponentUpdate&&!1===h.shouldComponentUpdate(b,h.__s,M)||u.__v==t.__v)){for(u.__v!=t.__v&&(h.props=b,h.state=h.__s,h.__d=!1),u.__e=t.__e,u.__k=t.__k,u.__k.some(function(n){n&&(n.__=u);}),P=0;P<h._sb.length;P++)h.__h.push(h._sb[P]);h._sb=[],h.__h.length&&e.push(h);break n}null!=h.componentWillUpdate&&h.componentWillUpdate(b,h.__s,M),C&&null!=h.componentDidUpdate&&h.__h.push(function(){h.componentDidUpdate(v,y,g);});}if(h.context=M,h.props=b,h.__P=n,h.__e=!1,I=l$1.__r,A=0,C){for(h.state=h.__s,h.__d=!1,I&&I(u),a=h.render(h.props,h.state,h.context),H=0;H<h._sb.length;H++)h.__h.push(h._sb[H]);h._sb=[];}else do{h.__d=!1,I&&I(u),a=h.render(h.props,h.state,h.context),h.state=h.__s;}while(h.__d&&++A<25);h.state=h.__s,null!=h.getChildContext&&(i=w$1(w$1({},i),h.getChildContext())),C&&!p&&null!=h.getSnapshotBeforeUpdate&&(g=h.getSnapshotBeforeUpdate(v,y)),f=$(n,d$1(L=null!=a&&a.type===k$1&&null==a.key?a.props.children:a)?L:[L],u,t,i,r,o,e,f,c,s),h.base=u.__e,u.__u&=-161,h.__h.length&&e.push(h),m&&(h.__E=h.__=null);}catch(n){if(u.__v=null,c||null!=o)if(n.then){for(u.__u|=c?160:128;f&&8==f.nodeType&&f.nextSibling;)f=f.nextSibling;o[o.indexOf(f)]=null,u.__e=f;}else for(T=o.length;T--;)_$1(o[T]);else u.__e=t.__e,u.__k=t.__k;l$1.__e(n,u,t);}else null==o&&u.__v==t.__v?(u.__k=t.__k,u.__e=t.__e):f=u.__e=N$1(t.__e,u,t,i,r,o,e,c,s);return (a=l$1.diffed)&&a(u),128&u.__u?undefined:f}function z$1(n,u,t){for(var i=0;i<t.length;i++)V$1(t[i],t[++i],t[++i]);l$1.__c&&l$1.__c(u,n),n.some(function(u){try{n=u.__h,u.__h=[],n.some(function(n){n.call(u);});}catch(n){l$1.__e(n,u.__v);}});}function N$1(u,t,i,r,o,e,f,c,s){var a,h,v,y,w,g,m,b=i.props,k=t.props,x=t.type;if("svg"==x?o="http://www.w3.org/2000/svg":"math"==x?o="http://www.w3.org/1998/Math/MathML":o||(o="http://www.w3.org/1999/xhtml"),null!=e)for(a=0;a<e.length;a++)if((w=e[a])&&"setAttribute"in w==!!x&&(x?w.localName==x:3==w.nodeType)){u=w,e[a]=null;break}if(null==u){if(null==x)return document.createTextNode(k);u=document.createElementNS(o,x,k.is&&k),c&&(l$1.__m&&l$1.__m(t,e),c=false),e=null;}if(null===x)b===k||c&&u.data===k||(u.data=k);else {if(e=e&&n.call(u.childNodes),b=i.props||p$1,!c&&null!=e)for(b={},a=0;a<u.attributes.length;a++)b[(w=u.attributes[a]).name]=w.value;for(a in b)if(w=b[a],"children"==a);else if("dangerouslySetInnerHTML"==a)v=w;else if(!(a in k)){if("value"==a&&"defaultValue"in k||"checked"==a&&"defaultChecked"in k)continue;F$1(u,a,null,w,o);}for(a in k)w=k[a],"children"==a?y=w:"dangerouslySetInnerHTML"==a?h=w:"value"==a?g=w:"checked"==a?m=w:c&&"function"!=typeof w||b[a]===w||F$1(u,a,w,b[a],o);if(h)c||v&&(h.__html===v.__html||h.__html===u.innerHTML)||(u.innerHTML=h.__html),t.__k=[];else if(v&&(u.innerHTML=""),$(u,d$1(y)?y:[y],t,i,r,"foreignObject"==x?"http://www.w3.org/1999/xhtml":o,e,f,e?e[0]:i.__k&&C$2(i,0),c,s),null!=e)for(a=e.length;a--;)_$1(e[a]);c||(a="value","progress"==x&&null==g?u.removeAttribute("value"):undefined!==g&&(g!==u[a]||"progress"==x&&!g||"option"==x&&g!==b[a])&&F$1(u,a,g,b[a],o),a="checked",undefined!==m&&m!==u[a]&&F$1(u,a,m,b[a],o));}return u}function V$1(n,u,t){try{if("function"==typeof n){var i="function"==typeof n.__u;i&&n.__u(),i&&null==u||(n.__u=n(u));}else n.current=u;}catch(n){l$1.__e(n,t);}}function q$1(n,u,t){var i,r;if(l$1.unmount&&l$1.unmount(n),(i=n.ref)&&(i.current&&i.current!==n.__e||V$1(i,null,u)),null!=(i=n.__c)){if(i.componentWillUnmount)try{i.componentWillUnmount();}catch(n){l$1.__e(n,u);}i.base=i.__P=null;}if(i=n.__k)for(r=0;r<i.length;r++)i[r]&&q$1(i[r],u,t||"function"!=typeof n.type);t||_$1(n.__e),n.__c=n.__=n.__e=undefined;}function B$2(n,l,u){return this.constructor(n,u)}function D$1(u,t,i){var r,o,e,f;t==document&&(t=document.documentElement),l$1.__&&l$1.__(u,t),o=(r="function"=="undefined")?null:t.__k,e=[],f=[],j$2(t,u=(t).__k=g$1(k$1,null,[u]),o||p$1,p$1,t.namespaceURI,o?null:t.firstChild?n.call(t.childNodes):null,e,o?o.__e:t.firstChild,r,f),z$1(e,u,f);}n=v$1.slice,l$1={__e:function(n,l,u,t){for(var i,r,o;l=l.__;)if((i=l.__c)&&!i.__)try{if((r=i.constructor)&&null!=r.getDerivedStateFromError&&(i.setState(r.getDerivedStateFromError(n)),o=i.__d),null!=i.componentDidCatch&&(i.componentDidCatch(n,t||{}),o=i.__d),o)return i.__E=i}catch(l){n=l;}throw n}},u$2=0,x$1.prototype.setState=function(n,l){var u;u=null!=this.__s&&this.__s!==this.state?this.__s:this.__s=w$1({},this.state),"function"==typeof n&&(n=n(w$1({},u),this.props)),n&&w$1(u,n),null!=n&&this.__v&&(l&&this._sb.push(l),M(this));},x$1.prototype.forceUpdate=function(n){this.__v&&(this.__e=true,n&&this.__h.push(n),M(this));},x$1.prototype.render=k$1,i$1=[],o$1="function"==typeof Promise?Promise.prototype.then.bind(Promise.resolve()):setTimeout,e$1=function(n,l){return n.__v.__b-l.__v.__b},P$1.__r=0,f$2=/(PointerCapture)$|Capture$/i,c$1=0,s$1=O(false),a$1=O(true);

var t,r,u$1,i,o=0,f$1=[],c=l$1,e=c.__b,a=c.__r,v=c.diffed,l=c.__c,m=c.unmount,s=c.__;function d(n,t){c.__h&&c.__h(r,n,o||t),o=0;var u=r.__H||(r.__H={__:[],__h:[]});return n>=u.__.length&&u.__.push({}),u.__[n]}function h(n){return o=1,p(D,n)}function p(n,u,i){var o=d(t++,2);if(o.t=n,!o.__c&&(o.__=[i?i(u):D(undefined,u),function(n){var t=o.__N?o.__N[0]:o.__[0],r=o.t(t,n);t!==r&&(o.__N=[r,o.__[1]],o.__c.setState({}));}],o.__c=r,!r.u)){var f=function(n,t,r){if(!o.__c.__H)return  true;var u=o.__c.__H.__.filter(function(n){return !!n.__c});if(u.every(function(n){return !n.__N}))return !c||c.call(this,n,t,r);var i=o.__c.props!==n;return u.forEach(function(n){if(n.__N){var t=n.__[0];n.__=n.__N,n.__N=undefined,t!==n.__[0]&&(i=true);}}),c&&c.call(this,n,t,r)||i};r.u=true;var c=r.shouldComponentUpdate,e=r.componentWillUpdate;r.componentWillUpdate=function(n,t,r){if(this.__e){var u=c;c=undefined,f(n,t,r),c=u;}e&&e.call(this,n,t,r);},r.shouldComponentUpdate=f;}return o.__N||o.__}function y(n,u){var i=d(t++,3);!c.__s&&C$1(i.__H,u)&&(i.__=n,i.i=u,r.__H.__h.push(i));}function _(n,u){var i=d(t++,4);!c.__s&&C$1(i.__H,u)&&(i.__=n,i.i=u,r.__h.push(i));}function j$1(){for(var n;n=f$1.shift();)if(n.__P&&n.__H)try{n.__H.__h.forEach(z),n.__H.__h.forEach(B$1),n.__H.__h=[];}catch(t){n.__H.__h=[],c.__e(t,n.__v);}}c.__b=function(n){r=null,e&&e(n);},c.__=function(n,t){n&&t.__k&&t.__k.__m&&(n.__m=t.__k.__m),s&&s(n,t);},c.__r=function(n){a&&a(n),t=0;var i=(r=n.__c).__H;i&&(u$1===r?(i.__h=[],r.__h=[],i.__.forEach(function(n){n.__N&&(n.__=n.__N),n.i=n.__N=undefined;})):(i.__h.forEach(z),i.__h.forEach(B$1),i.__h=[],t=0)),u$1=r;},c.diffed=function(n){v&&v(n);var t=n.__c;t&&t.__H&&(t.__H.__h.length&&(1!==f$1.push(t)&&i===c.requestAnimationFrame||((i=c.requestAnimationFrame)||w)(j$1)),t.__H.__.forEach(function(n){n.i&&(n.__H=n.i),n.i=undefined;})),u$1=r=null;},c.__c=function(n,t){t.some(function(n){try{n.__h.forEach(z),n.__h=n.__h.filter(function(n){return !n.__||B$1(n)});}catch(r){t.some(function(n){n.__h&&(n.__h=[]);}),t=[],c.__e(r,n.__v);}}),l&&l(n,t);},c.unmount=function(n){m&&m(n);var t,r=n.__c;r&&r.__H&&(r.__H.__.forEach(function(n){try{z(n);}catch(n){t=n;}}),r.__H=undefined,t&&c.__e(t,r.__v));};var k="function"==typeof requestAnimationFrame;function w(n){var t,r=function(){clearTimeout(u),k&&cancelAnimationFrame(t),setTimeout(n);},u=setTimeout(r,100);k&&(t=requestAnimationFrame(r));}function z(n){var t=r,u=n.__c;"function"==typeof u&&(n.__c=undefined,u()),r=t;}function B$1(n){var t=r;n.__c=n.__(),r=t;}function C$1(n,t){return !n||n.length!==t.length||t.some(function(t,r){return t!==n[r]})}function D(n,t){return "function"==typeof t?t(n):t}

function g(n,t){for(var e in t)n[e]=t[e];return n}function E(n,t){for(var e in n)if("__source"!==e&&!(e in t))return  true;for(var r in t)if("__source"!==r&&n[r]!==t[r])return  true;return  false}function C(n,t){var e=t(),r=h({t:{__:e,u:t}}),u=r[0].t,o=r[1];return _(function(){u.__=e,u.u=t,x(u)&&o({t:u});},[n,e,t]),y(function(){return x(u)&&o({t:u}),n(function(){x(u)&&o({t:u});})},[n]),e}function x(n){var t,e,r=n.u,u=n.__;try{var o=r();return !((t=u)===(e=o)&&(0!==t||1/t==1/e)||t!=t&&e!=e)}catch(n){return  true}}function N(n,t){this.props=n,this.context=t;}(N.prototype=new x$1).isPureReactComponent=true,N.prototype.shouldComponentUpdate=function(n,t){return E(this.props,n)||E(this.state,t)};var T=l$1.__b;l$1.__b=function(n){n.type&&n.type.__f&&n.ref&&(n.props.ref=n.ref,n.ref=null),T&&T(n);};var F=l$1.__e;l$1.__e=function(n,t,e,r){if(n.then)for(var u,o=t;o=o.__;)if((u=o.__c)&&u.__c)return null==t.__e&&(t.__e=e.__e,t.__k=e.__k),u.__c(n,t);F(n,t,e,r);};var U=l$1.unmount;function V(n,t,e){return n&&(n.__c&&n.__c.__H&&(n.__c.__H.__.forEach(function(n){"function"==typeof n.__c&&n.__c();}),n.__c.__H=null),null!=(n=g({},n)).__c&&(n.__c.__P===e&&(n.__c.__P=t),n.__c=null),n.__k=n.__k&&n.__k.map(function(n){return V(n,t,e)})),n}function W(n,t,e){return n&&e&&(n.__v=null,n.__k=n.__k&&n.__k.map(function(n){return W(n,t,e)}),n.__c&&n.__c.__P===t&&(n.__e&&e.appendChild(n.__e),n.__c.__e=true,n.__c.__P=e)),n}function P(){this.__u=0,this.o=null,this.__b=null;}function j(n){var t=n.__.__c;return t&&t.__a&&t.__a(n)}function B(){this.i=null,this.l=null;}l$1.unmount=function(n){var t=n.__c;t&&t.__R&&t.__R(),t&&32&n.__u&&(n.type=null),U&&U(n);},(P.prototype=new x$1).__c=function(n,t){var e=t.__c,r=this;null==r.o&&(r.o=[]),r.o.push(e);var u=j(r.__v),o=false,i=function(){o||(o=true,e.__R=null,u?u(c):c());};e.__R=i;var c=function(){if(!--r.__u){if(r.state.__a){var n=r.state.__a;r.__v.__k[0]=W(n,n.__c.__P,n.__c.__O);}var t;for(r.setState({__a:r.__b=null});t=r.o.pop();)t.forceUpdate();}};r.__u++||32&t.__u||r.setState({__a:r.__b=r.__v.__k[0]}),n.then(i,i);},P.prototype.componentWillUnmount=function(){this.o=[];},P.prototype.render=function(n,e){if(this.__b){if(this.__v.__k){var r=document.createElement("div"),o=this.__v.__k[0].__c;this.__v.__k[0]=V(this.__b,r,o.__O=o.__P);}this.__b=null;}var i=e.__a&&g$1(k$1,null,n.fallback);return i&&(i.__u&=-33),[g$1(k$1,null,e.__a?null:n.children),i]};var H=function(n,t,e){if(++e[1]===e[0]&&n.l.delete(t),n.props.revealOrder&&("t"!==n.props.revealOrder[0]||!n.l.size))for(e=n.i;e;){for(;e.length>3;)e.pop()();if(e[1]<e[0])break;n.i=e=e[2];}};(B.prototype=new x$1).__a=function(n){var t=this,e=j(t.__v),r=t.l.get(n);return r[0]++,function(u){var o=function(){t.props.revealOrder?(r.push(u),H(t,n,r)):u();};e?e(o):o();}},B.prototype.render=function(n){this.i=null,this.l=new Map;var t=H$1(n.children);n.revealOrder&&"b"===n.revealOrder[0]&&t.reverse();for(var e=t.length;e--;)this.l.set(t[e],this.i=[1,0,this.i]);return n.children},B.prototype.componentDidUpdate=B.prototype.componentDidMount=function(){var n=this;this.l.forEach(function(t,e){H(n,e,t);});};var q="undefined"!=typeof Symbol&&Symbol.for&&Symbol.for("react.element")||60103,G=/^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/,J=/^on(Ani|Tra|Tou|BeforeInp|Compo)/,K=/[A-Z0-9]/g,Q="undefined"!=typeof document,X=function(n){return ("undefined"!=typeof Symbol&&"symbol"==typeof Symbol()?/fil|che|rad/:/fil|che|ra/).test(n)};x$1.prototype.isReactComponent={},["componentWillMount","componentWillReceiveProps","componentWillUpdate"].forEach(function(t){Object.defineProperty(x$1.prototype,t,{configurable:true,get:function(){return this["UNSAFE_"+t]},set:function(n){Object.defineProperty(this,t,{configurable:true,writable:true,value:n});}});});var en=l$1.event;function rn(){}function un(){return this.cancelBubble}function on(){return this.defaultPrevented}l$1.event=function(n){return en&&(n=en(n)),n.persist=rn,n.isPropagationStopped=un,n.isDefaultPrevented=on,n.nativeEvent=n};var ln={enumerable:false,configurable:true,get:function(){return this.class}},fn=l$1.vnode;l$1.vnode=function(n){"string"==typeof n.type&&function(n){var t=n.props,e=n.type,u={},o=-1===e.indexOf("-");for(var i in t){var c=t[i];if(!("value"===i&&"defaultValue"in t&&null==c||Q&&"children"===i&&"noscript"===e||"class"===i||"className"===i)){var l=i.toLowerCase();"defaultValue"===i&&"value"in t&&null==t.value?i="value":"download"===i&&true===c?c="":"translate"===l&&"no"===c?c=false:"o"===l[0]&&"n"===l[1]?"ondoubleclick"===l?i="ondblclick":"onchange"!==l||"input"!==e&&"textarea"!==e||X(t.type)?"onfocus"===l?i="onfocusin":"onblur"===l?i="onfocusout":J.test(i)&&(i=l):l=i="oninput":o&&G.test(i)?i=i.replace(K,"-$&").toLowerCase():null===c&&(c=undefined),"oninput"===l&&u[i=l]&&(i="oninputCapture"),u[i]=c;}}"select"==e&&u.multiple&&Array.isArray(u.value)&&(u.value=H$1(t.children).forEach(function(n){n.props.selected=-1!=u.value.indexOf(n.props.value);})),"select"==e&&null!=u.defaultValue&&(u.value=H$1(t.children).forEach(function(n){n.props.selected=u.multiple?-1!=u.defaultValue.indexOf(n.props.value):u.defaultValue==n.props.value;})),t.class&&!t.className?(u.class=t.class,Object.defineProperty(u,"className",ln)):(t.className&&!t.class||t.class&&t.className)&&(u.class=u.className=t.className),n.props=u;}(n),n.$$typeof=q,fn&&fn(n);};var an=l$1.__r;l$1.__r=function(n){an&&an(n),n.__c;};var sn=l$1.diffed;l$1.diffed=function(n){sn&&sn(n);var t=n.props,e=n.__e;null!=e&&"textarea"===n.type&&"value"in t&&t.value!==e.value&&(e.value=null==t.value?"":t.value);};

var f=0;function u(e,t,n,o,i,u){t||(t={});var a,c,p=t;if("ref"in p)for(c in p={},t)"ref"==c?a=t[c]:p[c]=t[c];var l={type:e,props:p,key:n,ref:a,__k:null,__:null,__b:0,__e:null,__c:null,constructor:undefined,__v:--f,__i:-1,__u:0,__source:i,__self:u};if("function"==typeof e&&(a=e.defaultProps))for(c in a) undefined===p[c]&&(p[c]=a[c]);return l$1.vnode&&l$1.vnode(l),l}

const directoryIconUrl = new URL("../other/dir.png", import.meta.url).href;
const fileIconUrl = new URL("../other/file.png", import.meta.url).href;
const homeIconUrl = new URL("../other/home.svg#root", import.meta.url).href;
let {
  navItems,
  mainFilePath,
  directoryContentItems,
  enoentDetails,
  websocketUrl,
  autoreload
} = window.DIRECTORY_LISTING;
const directoryItemsChangeCallbackSet = new Set();
const updateDirectoryContentItems = value => {
  directoryContentItems = value;
  for (const dirContentItem of value) {
    if (dirContentItem.isMainFile && window.location.pathname === "/") {
      window.location.reload();
      return;
    }
    const isDirectory = new URL(dirContentItem.url).pathname.endsWith("/");
    if (!isDirectory && dirContentItem.urlRelativeToServer === window.location.pathname) {
      window.location.reload();
      return;
    }
  }
  for (const directoryItemsChangeCallback of directoryItemsChangeCallbackSet) {
    directoryItemsChangeCallback();
  }
};
const DirectoryListing = () => {
  const directoryItems = C(callback => {
    directoryItemsChangeCallbackSet.add(callback);
  }, () => {
    return directoryContentItems;
  });
  return u(k$1, {
    children: [enoentDetails ? u(ErrorMessage, {}) : null, u(Nav, {}), u(DirectoryContent, {
      items: directoryItems
    })]
  });
};
const ErrorMessage = () => {
  const {
    fileUrl,
    filePathExisting,
    filePathNotFound
  } = enoentDetails;
  return u("p", {
    className: "error_message",
    children: u("span", {
      className: "error_text",
      children: ["No filesystem entry at", " ", u("code", {
        title: fileUrl,
        children: [u("span", {
          className: "file_path_good",
          children: filePathExisting
        }), u("span", {
          className: "file_path_bad",
          children: filePathNotFound
        })]
      }), "."]
    })
  });
};
const Nav = () => {
  return u("h1", {
    className: "nav",
    children: navItems.map(navItem => {
      const {
        url,
        urlRelativeToServer,
        name,
        isCurrent,
        isServerRootDirectory
      } = navItem;
      const isDirectory = new URL(url).pathname.endsWith("/");
      return u(k$1, {
        children: [u(NavItem, {
          url: urlRelativeToServer,
          isCurrent: isCurrent,
          iconImageUrl: isServerRootDirectory ? homeIconUrl : "",
          iconLinkUrl: isServerRootDirectory ? `/${mainFilePath}` : "",
          children: name
        }, url), isDirectory ? u("span", {
          className: "directory_separator",
          children: "/"
        }) : null]
      });
    })
  });
};
const NavItem = ({
  url,
  iconImageUrl,
  iconLinkUrl,
  isCurrent,
  children
}) => {
  return u("span", {
    className: "nav_item",
    "data-current": isCurrent ? "" : undefined,
    children: [iconLinkUrl ? u("a", {
      className: "nav_item_icon"
      // eslint-disable-next-line react/no-unknown-property
      ,
      "hot-decline": true,
      href: iconLinkUrl,
      children: u(Icon, {
        url: iconImageUrl
      })
    }) : iconImageUrl ? u("span", {
      className: "nav_item_icon",
      children: u(Icon, {
        url: iconImageUrl
      })
    }) : null, url ? u("a", {
      className: "nav_item_text",
      href: url,
      children: children
    }) : u("span", {
      className: "nav_item_text",
      children: children
    })]
  });
};
const DirectoryContent = ({
  items
}) => {
  if (items.length === 0) {
    return u("p", {
      className: "directory_empty_message",
      children: "Directory is empty"
    });
  }
  return u("ul", {
    className: "directory_content",
    children: items.map(directoryItem => {
      return u(DirectoryContentItem, {
        url: directoryItem.urlRelativeToServer,
        isDirectory: directoryItem.url.endsWith("/"),
        isMainFile: directoryItem.isMainFile,
        children: directoryItem.urlRelativeToCurrentDirectory
      }, directoryItem.url);
    })
  });
};
const DirectoryContentItem = ({
  url,
  isDirectory,
  isMainFile,
  children
}) => {
  return u("li", {
    className: "directory_content_item",
    "data-directory": isDirectory ? "" : undefined,
    "data-file": isDirectory ? undefined : "",
    children: u("a", {
      className: "directory_content_item_link",
      href: url
      // eslint-disable-next-line react/no-unknown-property
      ,
      "hot-decline": isMainFile ? true : undefined,
      children: [u("span", {
        className: "directory_content_item_icon",
        children: u(Icon, {
          url: isMainFile ? homeIconUrl : isDirectory ? directoryIconUrl : fileIconUrl
        })
      }), children, isDirectory ? u(k$1, {
        children: [u("span", {
          style: "flex:1"
        }), u("span", {
          className: "directory_content_item_arrow",
          children: u(RightArrowSvg, {})
        })]
      }) : null]
    })
  });
};
const RightArrowSvg = () => {
  return u("svg", {
    fill: "currentColor",
    viewBox: "0 0 330 330",
    children: u("path", {
      stroke: "currentColor",
      d: "M250.606,154.389l-150-149.996c-5.857-5.858-15.355-5.858-21.213,0.001 c-5.857,5.858-5.857,15.355,0.001,21.213l139.393,139.39L79.393,304.394c-5.857,5.858-5.857,15.355,0.001,21.213 C82.322,328.536,86.161,330,90,330s7.678-1.464,10.607-4.394l149.999-150.004c2.814-2.813,4.394-6.628,4.394-10.606 C255,161.018,253.42,157.202,250.606,154.389z"
    })
  });
};
const Icon = ({
  url
}) => {
  if (urlToFilename(url).endsWith(".svg")) {
    return u("svg", {
      children: u("use", {
        href: url
      })
    });
  }
  return u("img", {
    src: url
  });
};
const urlToFilename = url => {
  const pathname = new URL(url).pathname;
  const pathnameBeforeLastSlash = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const slashLastIndex = pathnameBeforeLastSlash.lastIndexOf("/");
  const filename = slashLastIndex === -1 ? pathnameBeforeLastSlash : pathnameBeforeLastSlash.slice(slashLastIndex + 1);
  return filename;
};
if (autoreload) {
  const socket = new WebSocket(websocketUrl, ["watch-directory"]);
  socket.onopen = () => {
    socket.onopen = null;
    setInterval(() => {
      socket.send('{"type":"ping"}');
    }, 30_000);
  };
  socket.onmessage = messageEvent => {
    const event = JSON.parse(messageEvent.data);
    const {
      type,
      reason,
      items
    } = event;
    if (type === "change") {
      console.log(`update list (reason: ${reason})`);
      // TODO: if index.html is added AND we are at "/" we must reload
      updateDirectoryContentItems(items);
    }
  };
}
D$1(u(DirectoryListing, {}), document.querySelector("#root"));
