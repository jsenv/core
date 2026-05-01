var n,l$1,t$1,i$1,r$1,o$2,f$1,e$1,c$1,s$1,h$1,a$1={},p$1=[],v$1=/(mi|mn|mo|ms$|mte|msp)/,y$1=Array.isArray,w$1=p$1.slice,d$1=Object.assign;function g$1(n){n&&n.parentNode&&n.remove();}function _$1(n,l,u){var t,i,r,o={};for(r in l)"key"==r?t=l[r]:"ref"==r&&"function"!=typeof n?i=l[r]:o[r]=l[r];return arguments.length>2&&(o.children=arguments.length>3?w$1.call(arguments,2):u),m$1(n,o,t,i,null)}function m$1(u,t,i,r,o){var f={type:u,props:t,key:i,ref:r,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:null==o?++l$1:o,__i:-1,__u:0};return null==o&&null!=n.vnode&&n.vnode(f),f}function k$2(n){return n.children}function M(n,l){this.props=n,this.context=l,this.__g=0;}function $(n,l){if(null==l)return n.__?$(n.__,n.__i+1):null;for(var u;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e)return u.__e;return "function"==typeof n.type?$(n):null}function S(n){if(null!=(n=n.__)&&null!=n.__c)return n.__e=null,n.__k.some(function(l){if(null!=l&&null!=l.__e)return n.__e=l.__e}),S(n)}function x$1(l){(8&l.__g||!(l.__g|=8)||!t$1.push(l)||r$1++)&&i$1==n.debounceRendering||((i$1=n.debounceRendering)||queueMicrotask)(C$2);}function C$2(){for(var l,u,i,f,e,c,s,h,a=1;t$1.length;)t$1.length>a&&t$1.sort(o$2),l=t$1.shift(),a=t$1.length,8&l.__g&&(i=void 0,f=void 0,e=(f=(u=l).__v).__e,c=[],s=[],(h=u.__P)&&((i=d$1({},f)).__v=f.__v+1,n.vnode&&n.vnode(i),N$1(h,i,f,u.__n,h.namespaceURI,32&f.__u?[e]:null,c,null==e?$(f):e,!!(32&f.__u),s,h.ownerDocument),i.__v=f.__v,i.__.__k[i.__i]=i,V$1(c,i,s),f.__=f.__e=null,i.__e!=e&&S(i)));r$1=0;}function L(n,l,u,t,i,r,o,f,e,c,s,h){var v,y,w,d,g,_,m,b=t&&t.__k||p$1,k=l.length;for(e=j$2(u,l,b,e,k),v=0;v<k;v++)null!=(w=u.__k[v])&&(y=-1!=w.__i&&b[w.__i]||a$1,w.__i=v,_=N$1(n,w,y,i,r,o,f,e,c,s,h),d=w.__e,w.ref&&y.ref!=w.ref&&(y.ref&&D$1(y.ref,null,w),s.push(w.ref,w.__c||d,w)),null==g&&null!=d&&(g=d),(m=4&w.__u)||y.__k===w.__k?e=A$1(w,e,n,m):"function"==typeof w.type&&void 0!==_?e=_:d&&(e=d.nextSibling),w.__u&=-7);return u.__e=g,e}function j$2(n,l,u,t,i){var r,o,f,e,c,s=u.length,h=s,a=0;for(n.__k=new Array(i),r=0;r<i;r++)null!=(o=l[r])&&"boolean"!=typeof o&&"function"!=typeof o?("string"==typeof o||"number"==typeof o||"bigint"==typeof o||o.constructor==String?o=n.__k[r]=m$1(null,o,null,null,null):y$1(o)?o=n.__k[r]=m$1(k$2,{children:o},null,null,null):void 0===o.constructor&&o.__b>0?o=n.__k[r]=m$1(o.type,o.props,o.key,o.ref?o.ref:null,o.__v):n.__k[r]=o,e=r+a,o.__=n,o.__b=n.__b+1,f=null,-1!=(c=o.__i=I$1(o,u,e,h))&&(h--,(f=u[c])&&(f.__u|=2)),null==f||null==f.__v?(-1==c&&(i>s?a--:i<s&&a++),"function"!=typeof o.type&&(o.__u|=4)):c!=e&&(c==e-1?a--:c==e+1?a++:(c>e?a--:a++,o.__u|=4))):n.__k[r]=null;if(h)for(r=0;r<s;r++)null!=(f=u[r])&&0==(2&f.__u)&&(f.__e==t&&(t=$(f)),E$1(f,f));return t}function A$1(n,l,u,t){var i,r;if("function"==typeof n.type){for(i=n.__k,r=0;i&&r<i.length;r++)i[r]&&(i[r].__=n,l=A$1(i[r],l,u,t));return l}n.__e!=l&&(t&&(l&&n.type&&!l.parentNode&&(l=$(n)),u.insertBefore(n.__e,l||null)),l=n.__e);do{l=l&&l.nextSibling;}while(null!=l&&8==l.nodeType);return l}function H(n,l){return l=l||[],null==n||"boolean"==typeof n||(y$1(n)?n.some(function(n){H(n,l);}):l.push(n)),l}function I$1(n,l,u,t){var i,r,o,f=n.key,e=n.type,c=l[u],s=null!=c&&0==(2&c.__u);if(null===c&&null==f||s&&f==c.key&&e==c.type)return u;if(t>(s?1:0))for(i=u-1,r=u+1;i>=0||r<l.length;)if(null!=(c=l[o=i>=0?i--:r++])&&0==(2&c.__u)&&f==c.key&&e==c.type)return o;return  -1}function O$1(n,l,u){"-"==l[0]?n.setProperty(l,null==u?"":u):n[l]=null==u?"":u;}function T$1(n,l,u,t,i){var r;n:if("style"==l){if("string"==typeof u)n.style.cssText=u;else{if("string"==typeof t&&(n.style.cssText=t=""),t)for(l in t)u&&l in u||O$1(n.style,l,"");if(u)for(l in u)t&&u[l]==t[l]||O$1(n.style,l,u[l]);}}else if("o"==l[0]&&"n"==l[1])r=l!=(l=l.replace(f$1,"$1")),l=l.slice(2).toLowerCase(),n.__l||(n.__l={}),n.__l[l+r]=u,u?t?u.l=t.l:(u.l=e$1,n.addEventListener(l,r?s$1:c$1,r)):n.removeEventListener(l,r?s$1:c$1,r);else{if("http://www.w3.org/2000/svg"==i)l=l.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if("width"!=l&&"height"!=l&&"href"!=l&&"list"!=l&&"form"!=l&&"tabIndex"!=l&&"download"!=l&&"rowSpan"!=l&&"colSpan"!=l&&"role"!=l&&"popover"!=l&&l in n)try{n[l]=null==u?"":u;break n}catch(n){}"function"==typeof u||(null==u||false===u&&"-"!=l[4]?n.removeAttribute(l):n.setAttribute(l,"popover"==l&&1==u?"":u));}}function q$2(l){return function(u){if(this.__l){var t=this.__l[u.type+l];if(null==u.u)u.u=e$1++;else if(u.u<t.l)return;return t(n.event?n.event(u):u)}}}function N$1(l,u,t,i,r,o,f,e,c,s,h){var a,p,v,w,_,m,b,$,S,x,C,j,A,H,I,O,T,q,N,V=u.type;if(void 0!==u.constructor)return null;128&t.__u&&(c=32&t.__u)&&t.__c.__z&&(e=(o=t.__c.__z)[0],t.__c.__z=null),(a=n.__b)&&a(u);n:if("function"==typeof V)try{if(m=u.props,b="prototype"in V&&V.prototype.render,$=(a=V.contextType)&&i[a.__c],S=a?$?$.props.value:a.__:i,t.__c?2&(p=u.__c=t.__c).__g&&(p.__g|=1):(b?u.__c=p=new V(m,S):(u.__c=p=new M(m,S),p.constructor=V,p.render=F$2),$&&$.sub(p),p.state||(p.state={}),p.__n=i,p.__g|=8,p.__h=[],p._sb=[]),b&&null==p.__s&&(p.__s=p.state),b&&null!=V.getDerivedStateFromProps&&(p.__s==p.state&&(p.__s=d$1({},p.__s)),d$1(p.__s,V.getDerivedStateFromProps(m,p.__s))),v=p.props,w=p.state,p.__v=u,t.__c){if(b&&null==V.getDerivedStateFromProps&&m!==v&&null!=p.componentWillReceiveProps&&p.componentWillReceiveProps(m,S),u.__v==t.__v||!(4&p.__g)&&null!=p.shouldComponentUpdate&&!1===p.shouldComponentUpdate(m,p.__s,S)){u.__v!=t.__v&&(p.props=m,p.state=p.__s,p.__g&=-9),u.__e=t.__e,u.__k=t.__k,u.__k.some(function(n){n&&(n.__=u);}),(x=p.__h).push.apply(x,p._sb),p._sb=[],p.__h.length&&f.push(p);break n}null!=p.componentWillUpdate&&p.componentWillUpdate(m,p.__s,S),b&&null!=p.componentDidUpdate&&p.__h.push(function(){p.componentDidUpdate(v,w,_);});}else b&&null==V.getDerivedStateFromProps&&null!=p.componentWillMount&&p.componentWillMount(),b&&null!=p.componentDidMount&&p.__h.push(p.componentDidMount);if(p.context=S,p.props=m,p.__P=l,p.__g&=-5,C=n.__r,j=0,b)p.state=p.__s,p.__g&=-9,C&&C(u),a=p.render(p.props,p.state,p.context),(A=p.__h).push.apply(A,p._sb),p._sb=[];else do{p.__g&=-9,C&&C(u),a=p.render(p.props,p.state,p.context),p.state=p.__s;}while(8&p.__g&&++j<25);p.state=p.__s,null!=p.getChildContext&&(i=d$1({},i,p.getChildContext())),b&&t.__c&&null!=p.getSnapshotBeforeUpdate&&(_=p.getSnapshotBeforeUpdate(v,w)),H=null!=a&&a.type===k$2&&null==a.key?z$1(a.props.children):a,e=L(l,y$1(H)?H:[H],u,t,i,r,o,f,e,c,s,h),u.__u&=-161,p.__h.length&&f.push(p),2&p.__g&&(p.__g&=-4);}catch(l){if(u.__v=null,c||null!=o){if(l.then){for(I=0,u.__u|=c?160:128,u.__c.__z=[],T=0;T<o.length;T++)null==(q=o[T])||O||(8==q.nodeType?("$s"==q.data?(I&&u.__c.__z.push(q),I++):"/$s"==q.data&&(--I&&u.__c.__z.push(q),O=0==I,e=o[T]),o[T]=null):I&&(u.__c.__z.push(q),o[T]=null));if(!O){for(;e&&8==e.nodeType&&e.nextSibling;)e=e.nextSibling;o[o.indexOf(e)]=null,u.__c.__z=[e];}u.__e=e;}else{for(N=o.length;N--;)g$1(o[N]);P(u);}}else u.__e=t.__e,u.__k=t.__k,l.then||P(u);n.__e(l,u,t);}else e=u.__e=B$2(t.__e,u,t,i,r,o,f,c,s,h);return(a=n.diffed)&&a(u),128&u.__u?void 0:e}function P(n){n&&n.__c&&(n.__c.__g|=4),n&&n.__k&&n.__k.forEach(P);}function V$1(l,u,t){for(var i=0;i<t.length;i++)D$1(t[i],t[++i],t[++i]);n.__c&&n.__c(u,l),l.some(function(u){try{l=u.__h,u.__h=[],l.some(function(n){n.call(u);});}catch(l){n.__e(l,u.__v);}});}function z$1(n){return "object"!=typeof n||null==n||n.__b>0?n:y$1(n)?n.map(z$1):d$1({},n)}function B$2(l,u,t,i,r,o,f,e,c,s){var h,p,d,_,m,b,k,M,S=t.props||a$1,x=u.props,C=u.type;if("svg"==C?r="http://www.w3.org/2000/svg":"math"==C?r="http://www.w3.org/1998/Math/MathML":r||(r="http://www.w3.org/1999/xhtml"),null!=o)for(h=0;h<o.length;h++)if((m=o[h])&&"setAttribute"in m==!!C&&(C?m.localName==C:3==m.nodeType)){l=m,o[h]=null;break}if(null==l){if(null==C)return s.createTextNode(x);l=s.createElementNS(r,C,x.is&&x),e&&(n.__m&&n.__m(u,o),e=false),o=null;}if(null==C)S===x||e&&l.data==x||(l.data=x);else {if(o=o&&w$1.call(l.childNodes),!e&&null!=o)for(S={},h=0;h<l.attributes.length;h++)S[(m=l.attributes[h]).name]=m.value;for(h in S)m=S[h],"dangerouslySetInnerHTML"==h?d=m:"children"==h||h in x||"value"==h&&"defaultValue"in x||"checked"==h&&"defaultChecked"in x||T$1(l,h,null,m,r);for(h in M=1&t.__u,x)m=x[h],"children"==h?_=m:"dangerouslySetInnerHTML"==h?p=m:"value"==h?b=m:"checked"==h?k=m:e&&"function"!=typeof m||S[h]===m&&!M||T$1(l,h,m,S[h],r);if(p)e||d&&(p.__html==d.__html||p.__html==l.innerHTML)||(l.innerHTML=p.__html),u.__k=[];else if(d&&(l.innerHTML=""),("foreignObject"==C||"http://www.w3.org/1998/Math/MathML"==r&&v$1.test(C))&&(r="http://www.w3.org/1999/xhtml"),L("template"==C?l.content:l,y$1(_)?_:[_],u,t,i,r,o,f,o?o[0]:t.__k&&$(t,0),e,c,s),null!=o)for(h=o.length;h--;)g$1(o[h]);e||(h="value","progress"==C&&null==b?l.removeAttribute("value"):null==b||b===l[h]&&("progress"!==C||b)||T$1(l,h,b,S[h],r),h="checked",null!=k&&k!=l[h]&&T$1(l,h,k,S[h],r));}return l}function D$1(l,u,t){try{"function"==typeof l?("function"==typeof l.__u&&l.__u(),"function"==typeof l.__u&&null==u||(l.__u=l(u))):l.current=u;}catch(l){n.__e(l,t);}}function E$1(l,u,t){var i,r;if(n.unmount&&n.unmount(l),!(i=l.ref)||i.current&&i.current!=l.__e||D$1(i,null,u),null!=(i=l.__c)){if(i.componentWillUnmount)try{i.componentWillUnmount();}catch(l){n.__e(l,u);}i.__P=null;}if(i=l.__k)for(r=0;r<i.length;r++)i[r]&&E$1(i[r],u,t||"function"!=typeof l.type);t||g$1(l.__e),l.__e&&l.__e.__l&&(l.__e.__l=null),l.__e=l.__c=l.__=null;}function F$2(n,l,u){return this.constructor(n,u)}function G$1(l,u){var t,i,r,o;u==document&&(u=document.documentElement),n.__&&n.__(l,u),i=(t=l&&32&l.__u)?null:u.__k,u.__k=_$1(k$2,null,[l]),r=[],o=[],N$1(u,u.__k,i||a$1,a$1,u.namespaceURI,i?null:u.firstChild?w$1.call(u.childNodes):null,r,i?i.__e:u.firstChild,t,o,u.ownerDocument),V$1(r,u.__k,o);}function Q$1(n){function l(n){var u,t;return this.getChildContext||(u=new Set,(t={})[l.__c]=this,this.getChildContext=function(){return t},this.componentWillUnmount=function(){u=null;},this.shouldComponentUpdate=function(n){this.props.value!=n.value&&u.forEach(function(n){n.__g|=4,x$1(n);});},this.sub=function(n){u.add(n);var l=n.componentWillUnmount;n.componentWillUnmount=function(){u&&u.delete(n),l&&l.call(n);};}),n.children}return l.__c="__cC"+h$1++,l.__=n,l.Provider=l.__l=(l.Consumer=function(n,l){return n.children(l)}).contextType=l,l}n={__e:function(n,l,u,t){for(var i,o,f;l=l.__;)if((i=l.__c)&&!(1&i.__g)){i.__g|=4;try{if((o=i.constructor)&&null!=o.getDerivedStateFromError&&(i.setState(o.getDerivedStateFromError(n)),f=8&i.__g),null!=i.componentDidCatch&&(i.componentDidCatch(n,t||{}),f=8&i.__g),f)return void(i.__g|=2)}catch(l){n=l;}}throw r$1=0,n}},l$1=0,M.prototype.setState=function(n,l){var u;u=null!=this.__s&&this.__s!=this.state?this.__s:this.__s=d$1({},this.state),"function"==typeof n&&(n=n(d$1({},u),this.props)),n&&(d$1(u,n),this.__v&&(l&&this._sb.push(l),x$1(this)));},M.prototype.forceUpdate=function(n){this.__v&&(this.__g|=4,n&&this.__h.push(n),x$1(this));},M.prototype.render=k$2,t$1=[],r$1=0,o$2=function(n,l){return n.__v.__b-l.__v.__b},f$1=/(PointerCapture)$|Capture$/i,e$1=0,c$1=q$2(false),s$1=q$2(true),h$1=0;

var t,r,u$1,i,o$1=Object.is,f=0,c=[],e=n,a=e.__b,v=e.__r,l=e.diffed,m=e.__c,p=e.unmount,s=e.__;function d(n,t){e.__h&&e.__h(r,n,f||t),f=0;var u=r.__H||(r.__H={__:[],__h:[]});return n>=u.__.length&&u.__.push({}),u.__[n]}function y(n){return f=1,h(D,n)}function h(n,u,i){var f=d(t++,2);if(f.t=n,!f.__c&&(f.__=[i?i(u):D(void 0,u),function(n){var t=f.__N?f.__N[0]:f.__[0],r=f.t(t,n);o$1(t,r)||(f.__N=[r,f.__[1]],f.__c.setState({}));}],f.__c=r,!r.__f)){var c=function(n,t,r){if(!f.__c.__H)return  true;var u=f.__c.__H.__,i=f.__c.props!==n||u.every(function(n){return !n.__N});return u.some(function(n){if(n.__N){var t=n.__[0];n.__=n.__N,n.__N=void 0,o$1(t,n.__[0])||(i=true);}}),e&&e.call(this,n,t,r)||i};r.__f=true;var e=r.shouldComponentUpdate,a=r.componentWillUpdate;r.componentWillUpdate=function(n,t,r){if(4&this.__g){var u=e;e=void 0,c(n,t,r),e=u;}a&&a.call(this,n,t,r);},r.shouldComponentUpdate=c;}return f.__}function _(n,u){var i=d(t++,3);!e.__s&&C$1(i.__H,u)&&(i.__=n,i.u=u,r.__H.__h.push(i));}function A(n,u){var i=d(t++,4);!e.__s&&C$1(i.__H,u)&&(i.__=n,i.u=u,r.__h.push(i));}function F$1(n){return f=5,q$1(function(){return {current:n}},[])}function q$1(n,r){var u=d(t++,7);return C$1(u.__H,r)&&(u.__=n(),u.__H=r,u.__h=n),u.__}function b(n,t){return f=8,q$1(function(){return n},t)}function j$1(n){var u=r.context[n.__c],i=d(t++,9);return i.c=n,u?(null==i.__&&(i.__=true,u.sub(r)),u.props.value):n.__}function x(n,t){e.useDebugValue&&e.useDebugValue(t?t(n):n);}function g(){for(var n;n=c.shift();)if(n.__P&&n.__H)try{n.__H.__h.some(z),n.__H.__h.some(B$1),n.__H.__h=[];}catch(t){n.__H.__h=[],e.__e(t,n.__v);}}e.__b=function(n){r=null,a&&a(n);},e.__=function(n,t){n&&t.__k&&t.__k.__m&&(n.__m=t.__k.__m),s&&s(n,t);},e.__r=function(n){v&&v(n),t=0;var i=(r=n.__c).__H;i&&(u$1===r?(i.__h=[],r.__h=[],i.__.some(function(n){n.__N&&(n.__=n.__N),n.u=n.__N=void 0;})):(i.__h.some(z),i.__h.some(B$1),i.__h=[],t=0)),u$1=r;},e.diffed=function(n){l&&l(n);var t=n.__c;t&&t.__H&&(t.__H.__h.length&&(1!==c.push(t)&&i===e.requestAnimationFrame||((i=e.requestAnimationFrame)||w)(g)),t.__H.__.some(function(n){n.u&&(n.__H=n.u),n.u=void 0;})),u$1=r=null;},e.__c=function(n,t){t.some(function(n){try{n.__h.some(z),n.__h=n.__h.filter(function(n){return !n.__||B$1(n)});}catch(r){t.some(function(n){n.__h&&(n.__h=[]);}),t=[],e.__e(r,n.__v);}}),m&&m(n,t);},e.unmount=function(n){p&&p(n);var t,r=n.__c;r&&r.__H&&(r.__H.__.some(function(n){try{z(n);}catch(n){t=n;}}),r.__H=void 0,t&&e.__e(t,r.__v));};var k$1="function"==typeof requestAnimationFrame;function w(n){var t,r=function(){clearTimeout(u),k$1&&cancelAnimationFrame(t),setTimeout(n);},u=setTimeout(r,35);k$1&&(t=requestAnimationFrame(r));}function z(n){var t=r,u=n.__c;"function"==typeof u&&(n.__c=void 0,u()),r=t;}function B$1(n){var t=r;n.__c=n.__(),r=t;}function C$1(n,t){return !n||n.length!==t.length||t.some(function(t,r){return !o$1(t,n[r])})}function D(n,t){return "function"==typeof t?t(n):t}

function E(n,e){var t=e(),r=y({t:{__:t,u:e}}),u=r[0].t,o=r[1];return A(function(){u.__=t,u.u=e,C(u)&&o({t:u});},[n,t,e]),_(function(){return C(u)&&o({t:u}),n(function(){C(u)&&o({t:u});})},[n]),t}function C(n){try{return !Object.is(n.__,n.u())}catch(n){return  true}}var I=Object.assign;function k(n,e){for(var t in n)if("__source"!==t&&!(t in e))return  true;for(var r in e)if("__source"!==r&&n[r]!==e[r])return  true;return  false}var N=/^(-|f[lo].*[^se]$|g.{5,}[^ps]$|z|o[pr]|(W.{5})?[lL]i.*(t|mp)$|an|(bo|s).{4}Im|sca|m.{6}[ds]|ta|c.*[st]$|wido|ini)/;function O(n,e){this.props=n,this.context=e;}(O.prototype=new M).isPureReactComponent=true,O.prototype.shouldComponentUpdate=function(n,e){return k(this.props,n)||k(this.state,e)};var F=n.__e;n.__e=function(n,e,t,r){if(n.then)for(var u,o=e;o=o.__;)if((u=o.__c)&&u.__c)return null==e.__e&&(e.__e=t.__e,e.__k=t.__k),u.__c(n,e);F(n,e,t,r);};var T=n.unmount;function V(n,e,t){return n&&(n.__c&&n.__c.__H&&(n.__c.__H.__.forEach(function(n){"function"==typeof n.__c&&n.__c();}),n.__c.__H=null),null!=(n=I({},n)).__c&&(n.__c.__P===t&&(n.__c.__P=e),n.__c.__g|=4,n.__c=null),n.__k=n.__k&&n.__k.map(function(n){return V(n,e,t)})),n}function j(n,e,t){return n&&t&&("string"==typeof n.type&&(n.__u|=1),n.__v=null,n.__k=n.__k&&n.__k.map(function(n){return j(n,e,t)}),n.__c&&n.__c.__P===e&&(n.__e&&t.appendChild(n.__e),n.__c.__g|=4,n.__c.__P=t)),n}function W(){this.__u=0,this.o=null,this.__b=null;}n.unmount=function(n){var e=n.__c;e&&(e.__z=true),e&&e.__R&&e.__R(),T&&T(n);},(W.prototype=new M).__c=function(n,e){var t=e.__c,r=this;null==r.o&&(r.o=[]),r.o.push(t);var u=false,o=function(){u||r.__z||(u=true,t.__R=null,l());};t.__R=o;var i=t.__P;t.__P=null;var l=function(){if(! --r.__u){if(r.state.__a){var n=r.state.__a;r.__v.__k[0]=j(n,n.__c.__P,n.__c.__O);}var e;for(r.setState({__a:r.__b=null});e=r.o.pop();)e.__P=i,e.forceUpdate();}};r.__u++||32&e.__u||r.setState({__a:r.__b=r.__v.__k[0]}),n.then(o,o);},W.prototype.componentWillUnmount=function(){this.o=[];},W.prototype.render=function(n,t){if(this.__b){if(this.__v.__k){var r=document.createElement("div"),o=this.__v.__k[0].__c;this.__v.__k[0]=V(this.__b,r,o.__O=o.__P);}this.__b=null;}return[_$1(k$2,null,t.__a?null:n.children),t.__a&&_$1(k$2,null,n.fallback)]};var B=Symbol.for("react.element"),Z=/^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/,Y=/[A-Z0-9]/g,q="undefined"!=typeof document,G=function(n){return /fil|che|rad/.test(n)};M.prototype.isReactComponent={},["componentWillMount","componentWillReceiveProps","componentWillUpdate"].forEach(function(e){Object.defineProperty(M.prototype,e,{configurable:true,get:function(){return this["UNSAFE_"+e]},set:function(n){Object.defineProperty(this,e,{configurable:true,writable:true,value:n});}});});var Q=n.event;function X(){}function nn(){return this.cancelBubble}function en(){return this.defaultPrevented}n.event=function(n){return Q&&(n=Q(n)),n.persist=X,n.isPropagationStopped=nn,n.isDefaultPrevented=en,n.nativeEvent=n};var rn={enumerable:false,configurable:true,get:function(){return this.class}},un=n.vnode;n.vnode=function(n){if("string"==typeof n.type)!function(n){var e=n.props,r=n.type,u={},o=-1===r.indexOf("-");for(var i in e){var l=e[i];if(!("value"===i&&"defaultValue"in e&&null==l||q&&"children"===i&&"noscript"===r||"class"===i||"className"===i)){if("style"===i&&"object"==typeof l)for(var c in l)"number"!=typeof l[c]||N.test(c)||(l[c]+="px");else if("defaultValue"===i&&"value"in e&&null==e.value)i="value";else if("download"===i&&true===l)l="";else if("translate"===i&&"no"===l)l=false;else if("o"===i[0]&&"n"===i[1]){var a=i.toLowerCase();"ondoubleclick"===a?i="ondblclick":"onchange"!==a||"input"!==r&&"textarea"!==r||G(e.type)?"onfocus"===a?i="onfocusin":"onblur"===a&&(i="onfocusout"):a=i="oninput","oninput"===a&&u[i=a]&&(i="oninputCapture");}else o&&Z.test(i)?i=i.replace(Y,"-$&").toLowerCase():null===l&&(l=void 0);u[i]=l;}}"select"==r&&u.multiple&&Array.isArray(u.value)&&(u.value=H(e.children).forEach(function(n){n.props.selected=-1!=u.value.indexOf(n.props.value);})),"select"==r&&null!=u.defaultValue&&(u.value=H(e.children).forEach(function(n){n.props.selected=u.multiple?-1!=u.defaultValue.indexOf(n.props.value):u.defaultValue==n.props.value;})),e.class&&!e.className?(u.class=e.class,Object.defineProperty(u,"className",rn)):e.className&&(u.class=u.className=e.className),n.props=u;}(n);else if("function"==typeof n.type&&("ref"in n.props&&"prototype"in n.type&&n.type.prototype.render&&(n.ref=n.props.ref,delete n.props.ref),n.type.defaultProps)){var e=I({},n.props);for(var r in n.type.defaultProps) void 0===e[r]&&(e[r]=n.type.defaultProps[r]);n.props=e;}n.$$typeof=B,un&&un(n);};var on=n.__r;n.__r=function(n){on&&on(n),n.__c;};var ln=n.diffed;n.diffed=function(n){ln&&ln(n);var e=n.props,t=n.__e;null!=t&&"textarea"===n.type&&"value"in e&&e.value!==t.value&&(t.value=null==e.value?"":e.value);};var En={useEffect:_,useSyncExternalStore:E,useRef:F$1,useMemo:q$1,useDebugValue:x};

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
	var React = En;
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
	    var inst = { hasValue: false, value: null };
	    instRef.current = inst;
	  } else inst = instRef.current;
	  instRef = useMemo(
	    function () {
	      function memoizedSelector(nextSnapshot) {
	        if (!hasMemo) {
	          hasMemo = true;
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
	      var hasMemo = false,
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
	      inst.hasValue = true;
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




function defaultNoopBatch(callback) {
  callback();
}


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


var canUseDOM = () => !!(typeof window !== "undefined" && typeof window.document !== "undefined" && typeof window.document.createElement !== "undefined");
var isDOM =                 canUseDOM();
var isRunningInReactNative = () => typeof navigator !== "undefined" && navigator.product === "ReactNative";
var isReactNative =                 isRunningInReactNative();
var getUseIsomorphicLayoutEffect = () => isDOM || isReactNative ? A : _;
var useIsomorphicLayoutEffect =                 getUseIsomorphicLayoutEffect();


var ContextKey =                 Symbol.for(`react-redux-context`);
var gT = typeof globalThis !== "undefined" ? globalThis : (

  {}
);
function getContext() {
  if (!Q$1) return {};
  const contextMap = gT[ContextKey] ??=                 new Map();
  let realContext = contextMap.get(Q$1);
  if (!realContext) {
    realContext = Q$1(
      null
    );
    contextMap.set(Q$1, realContext);
  }
  return realContext;
}
var ReactReduxContext =                 getContext();


function Provider(providerProps) {
  const { children, context, serverState, store } = providerProps;
  const contextValue = q$1(() => {
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
  const previousState = q$1(() => store.getState(), [store]);
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
  return                 _$1(Context.Provider, { value: contextValue }, children);
}
var Provider_default = Provider;


function createReduxContextHook(context = ReactReduxContext) {
  return function useReduxContext2() {
    const contextValue = j$1(context);
    return contextValue;
  };
}
var useReduxContext =                 createReduxContextHook();


function createStoreHook(context = ReactReduxContext) {
  const useReduxContext2 = context === ReactReduxContext ? useReduxContext : (

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
var useStore =                 createStoreHook();


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
var useDispatch =                 createDispatchHook();
var refEquality = (a, b) => a === b;
function createSelectorHook(context = ReactReduxContext) {
  const useReduxContext2 = context === ReactReduxContext ? useReduxContext : createReduxContextHook(context);
  const useSelector2 = (selector, equalityFnOrOptions = {}) => {
    const { equalityFn = refEquality } = typeof equalityFnOrOptions === "function" ? { equalityFn: equalityFnOrOptions } : equalityFnOrOptions;
    const reduxContext = useReduxContext2();
    const { store, subscription, getServerState } = reduxContext;
    F$1(true);
    const wrappedSelector = b(
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
    x(selectedState);
    return selectedState;
  };
  Object.assign(useSelector2, {
    withTypes: () => useSelector2
  });
  return useSelector2;
}
var useSelector =                 createSelectorHook();


function formatProdErrorMessage(code) {
  return `Minified Redux error #${code}; visit https://redux.js.org/Errors?code=${code} for the full message or use the non-minified dev environment for full errors. `;
}


var $$observable =                 (() => typeof Symbol === "function" && Symbol.observable || "@@observable")();
var symbol_observable_default = $$observable;


var randomString = () => Math.random().toString(36).substring(7).split("").join(".");
var ActionTypes = {
  INIT: `@@redux/INIT${                randomString()}`,
  REPLACE: `@@redux/REPLACE${                randomString()}`,
  PROBE_UNKNOWN_ACTION: () => `@@redux/PROBE_UNKNOWN_ACTION${randomString()}`
};
var actionTypes_default = ActionTypes;


function isPlainObject(obj) {
  if (typeof obj !== "object" || obj === null)
    return false;
  let proto = obj;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return Object.getPrototypeOf(obj) === proto || Object.getPrototypeOf(obj) === null;
}


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
  let currentListeners =                 new Map();
  let nextListeners = currentListeners;
  let listenerIdCounter = 0;
  let isDispatching = false;
  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners =                 new Map();
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


function compose(...funcs) {
  if (funcs.length === 0) {
    return (arg) => arg;
  }
  if (funcs.length === 1) {
    return funcs[0];
  }
  return funcs.reduce((a, b) => (...args) => a(b(...args)));
}

var o=0;function u(t,e,n$1,f,u,i){e||(e={});var a,c,l=e;if("ref"in l&&"function"!=typeof t)for(c in l={},e)"ref"==c?a=e[c]:l[c]=e[c];var p={type:t,props:l,key:n$1,ref:a,__k:null,__:null,__b:0,__e:null,__c:null,constructor:void 0,__v:--o,__i:-1,__u:0,__source:u,__self:i};return n.vnode&&n.vnode(p),p}

export { G$1 as G, Provider_default, _, combineReducers, compose, createStore, u, useDispatch, useSelector };