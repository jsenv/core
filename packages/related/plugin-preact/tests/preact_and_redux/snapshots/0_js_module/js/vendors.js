var n$5,l$7,u$6,t$6,o$4,r$6,f$5,c$5={},s$2=[],a$3=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,v$6=Array.isArray;function h$6(n,l){for(var u in l)n[u]=l[u];return n}function p$7(n){var l=n.parentNode;l&&l.removeChild(n);}function y$3(l,u,i){var t,o,r,f={};for(r in u)"key"==r?t=u[r]:"ref"==r?o=u[r]:f[r]=u[r];if(arguments.length>2&&(f.children=arguments.length>3?n$5.call(arguments,2):i),"function"==typeof l&&null!=l.defaultProps)for(r in l.defaultProps)void 0===f[r]&&(f[r]=l.defaultProps[r]);return d$5(l,f,t,o,null)}function d$5(n,i,t,o,r){var f={type:n,props:i,key:t,ref:o,__k:null,__:null,__b:0,__e:null,__d:void 0,__c:null,__h:null,constructor:void 0,__v:null==r?++u$6:r};return null==r&&null!=l$7.vnode&&l$7.vnode(f),f}function k$8(n){return n.children}function b$5(n,l){this.props=n,this.context=l;}function g$6(n,l){if(null==l)return n.__?g$6(n.__,n.__.__k.indexOf(n)+1):null;for(var u;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e)return u.__e;return "function"==typeof n.type?g$6(n):null}function m$7(n){var l,u;if(null!=(n=n.__)&&null!=n.__c){for(n.__e=n.__c.base=null,l=0;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e){n.__e=n.__c.base=u.__e;break}return m$7(n)}}function w$6(n){(!n.__d&&(n.__d=!0)&&t$6.push(n)&&!x$4.__r++||o$4!==l$7.debounceRendering)&&((o$4=l$7.debounceRendering)||r$6)(x$4);}function x$4(){var n,l,u,i,o,r,e,c;for(t$6.sort(f$5);n=t$6.shift();)n.__d&&(l=t$6.length,i=void 0,o=void 0,e=(r=(u=n).__v).__e,(c=u.__P)&&(i=[],(o=h$6({},r)).__v=r.__v+1,L$2(c,r,o,u.__n,void 0!==c.ownerSVGElement,null!=r.__h?[e]:null,i,null==e?g$6(r):e,r.__h),M$2(i,r),r.__e!=e&&m$7(r)),t$6.length>l&&t$6.sort(f$5));x$4.__r=0;}function P$2(n,l,u,i,t,o,r,f,e,a){var h,p,y,_,b,m,w,x=i&&i.__k||s$2,P=x.length;for(u.__k=[],h=0;h<l.length;h++)if(null!=(_=u.__k[h]=null==(_=l[h])||"boolean"==typeof _||"function"==typeof _?null:"string"==typeof _||"number"==typeof _||"bigint"==typeof _?d$5(null,_,null,null,_):v$6(_)?d$5(k$8,{children:_},null,null,null):_.__b>0?d$5(_.type,_.props,_.key,_.ref?_.ref:null,_.__v):_)){if(_.__=u,_.__b=u.__b+1,null===(y=x[h])||y&&_.key==y.key&&_.type===y.type)x[h]=void 0;else for(p=0;p<P;p++){if((y=x[p])&&_.key==y.key&&_.type===y.type){x[p]=void 0;break}y=null;}L$2(n,_,y=y||c$5,t,o,r,f,e,a),b=_.__e,(p=_.ref)&&y.ref!=p&&(w||(w=[]),y.ref&&w.push(y.ref,null,_),w.push(p,_.__c||b,_)),null!=b?(null==m&&(m=b),"function"==typeof _.type&&_.__k===y.__k?_.__d=e=C$2(_,e,n):e=$$2(n,_,y,x,b,e),"function"==typeof u.type&&(u.__d=e)):e&&y.__e==e&&e.parentNode!=n&&(e=g$6(y));}for(u.__e=m,h=P;h--;)null!=x[h]&&("function"==typeof u.type&&null!=x[h].__e&&x[h].__e==u.__d&&(u.__d=A$4(i).nextSibling),q$7(x[h],x[h]));if(w)for(h=0;h<w.length;h++)O$2(w[h],w[++h],w[++h]);}function C$2(n,l,u){for(var i,t=n.__k,o=0;t&&o<t.length;o++)(i=t[o])&&(i.__=n,l="function"==typeof i.type?C$2(i,l,u):$$2(u,i,i,t,i.__e,l));return l}function $$2(n,l,u,i,t,o){var r,f,e;if(void 0!==l.__d)r=l.__d,l.__d=void 0;else if(null==u||t!=o||null==t.parentNode)n:if(null==o||o.parentNode!==n)n.appendChild(t),r=null;else {for(f=o,e=0;(f=f.nextSibling)&&e<i.length;e+=1)if(f==t)break n;n.insertBefore(t,o),r=o;}return void 0!==r?r:t.nextSibling}function A$4(n){var l,u,i;if(null==n.type||"string"==typeof n.type)return n.__e;if(n.__k)for(l=n.__k.length-1;l>=0;l--)if((u=n.__k[l])&&(i=A$4(u)))return i;return null}function H$2(n,l,u,i,t){var o;for(o in u)"children"===o||"key"===o||o in l||T$3(n,o,null,u[o],i);for(o in l)t&&"function"!=typeof l[o]||"children"===o||"key"===o||"value"===o||"checked"===o||u[o]===l[o]||T$3(n,o,l[o],u[o],i);}function I$2(n,l,u){"-"===l[0]?n.setProperty(l,null==u?"":u):n[l]=null==u?"":"number"!=typeof u||a$3.test(l)?u:u+"px";}function T$3(n,l,u,i,t){var o;n:if("style"===l)if("string"==typeof u)n.style.cssText=u;else {if("string"==typeof i&&(n.style.cssText=i=""),i)for(l in i)u&&l in u||I$2(n.style,l,"");if(u)for(l in u)i&&u[l]===i[l]||I$2(n.style,l,u[l]);}else if("o"===l[0]&&"n"===l[1])o=l!==(l=l.replace(/Capture$/,"")),l=l.toLowerCase()in n?l.toLowerCase().slice(2):l.slice(2),n.l||(n.l={}),n.l[l+o]=u,u?i||n.addEventListener(l,o?z$5:j$4,o):n.removeEventListener(l,o?z$5:j$4,o);else if("dangerouslySetInnerHTML"!==l){if(t)l=l.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if("width"!==l&&"height"!==l&&"href"!==l&&"list"!==l&&"form"!==l&&"tabIndex"!==l&&"download"!==l&&"rowSpan"!==l&&"colSpan"!==l&&l in n)try{n[l]=null==u?"":u;break n}catch(n){}"function"==typeof u||(null==u||!1===u&&"-"!==l[4]?n.removeAttribute(l):n.setAttribute(l,u));}}function j$4(n){return this.l[n.type+!1](l$7.event?l$7.event(n):n)}function z$5(n){return this.l[n.type+!0](l$7.event?l$7.event(n):n)}function L$2(n,u,i,t,o,r,f,e,c){var s,a,p,y,d,_,g,m,w,x,C,S,$,A,H,I=u.type;if(void 0!==u.constructor)return null;null!=i.__h&&(c=i.__h,e=u.__e=i.__e,u.__h=null,r=[e]),(s=l$7.__b)&&s(u);try{n:if("function"==typeof I){if(m=u.props,w=(s=I.contextType)&&t[s.__c],x=s?w?w.props.value:s.__:t,i.__c?g=(a=u.__c=i.__c).__=a.__E:("prototype"in I&&I.prototype.render?u.__c=a=new I(m,x):(u.__c=a=new b$5(m,x),a.constructor=I,a.render=B$3),w&&w.sub(a),a.props=m,a.state||(a.state={}),a.context=x,a.__n=t,p=a.__d=!0,a.__h=[],a._sb=[]),null==a.__s&&(a.__s=a.state),null!=I.getDerivedStateFromProps&&(a.__s==a.state&&(a.__s=h$6({},a.__s)),h$6(a.__s,I.getDerivedStateFromProps(m,a.__s))),y=a.props,d=a.state,a.__v=u,p)null==I.getDerivedStateFromProps&&null!=a.componentWillMount&&a.componentWillMount(),null!=a.componentDidMount&&a.__h.push(a.componentDidMount);else {if(null==I.getDerivedStateFromProps&&m!==y&&null!=a.componentWillReceiveProps&&a.componentWillReceiveProps(m,x),!a.__e&&null!=a.shouldComponentUpdate&&!1===a.shouldComponentUpdate(m,a.__s,x)||u.__v===i.__v){for(u.__v!==i.__v&&(a.props=m,a.state=a.__s,a.__d=!1),a.__e=!1,u.__e=i.__e,u.__k=i.__k,u.__k.forEach(function(n){n&&(n.__=u);}),C=0;C<a._sb.length;C++)a.__h.push(a._sb[C]);a._sb=[],a.__h.length&&f.push(a);break n}null!=a.componentWillUpdate&&a.componentWillUpdate(m,a.__s,x),null!=a.componentDidUpdate&&a.__h.push(function(){a.componentDidUpdate(y,d,_);});}if(a.context=x,a.props=m,a.__P=n,S=l$7.__r,$=0,"prototype"in I&&I.prototype.render){for(a.state=a.__s,a.__d=!1,S&&S(u),s=a.render(a.props,a.state,a.context),A=0;A<a._sb.length;A++)a.__h.push(a._sb[A]);a._sb=[];}else do{a.__d=!1,S&&S(u),s=a.render(a.props,a.state,a.context),a.state=a.__s;}while(a.__d&&++$<25);a.state=a.__s,null!=a.getChildContext&&(t=h$6(h$6({},t),a.getChildContext())),p||null==a.getSnapshotBeforeUpdate||(_=a.getSnapshotBeforeUpdate(y,d)),P$2(n,v$6(H=null!=s&&s.type===k$8&&null==s.key?s.props.children:s)?H:[H],u,i,t,o,r,f,e,c),a.base=u.__e,u.__h=null,a.__h.length&&f.push(a),g&&(a.__E=a.__=null),a.__e=!1;}else null==r&&u.__v===i.__v?(u.__k=i.__k,u.__e=i.__e):u.__e=N$2(i.__e,u,i,t,o,r,f,c);(s=l$7.diffed)&&s(u);}catch(n){u.__v=null,(c||null!=r)&&(u.__e=e,u.__h=!!c,r[r.indexOf(e)]=null),l$7.__e(n,u,i);}}function M$2(n,u){l$7.__c&&l$7.__c(u,n),n.some(function(u){try{n=u.__h,u.__h=[],n.some(function(n){n.call(u);});}catch(n){l$7.__e(n,u.__v);}});}function N$2(l,u,i,t,o,r,f,e){var s,a,h,y=i.props,d=u.props,_=u.type,k=0;if("svg"===_&&(o=!0),null!=r)for(;k<r.length;k++)if((s=r[k])&&"setAttribute"in s==!!_&&(_?s.localName===_:3===s.nodeType)){l=s,r[k]=null;break}if(null==l){if(null===_)return document.createTextNode(d);l=o?document.createElementNS("http://www.w3.org/2000/svg",_):document.createElement(_,d.is&&d),r=null,e=!1;}if(null===_)y===d||e&&l.data===d||(l.data=d);else {if(r=r&&n$5.call(l.childNodes),a=(y=i.props||c$5).dangerouslySetInnerHTML,h=d.dangerouslySetInnerHTML,!e){if(null!=r)for(y={},k=0;k<l.attributes.length;k++)y[l.attributes[k].name]=l.attributes[k].value;(h||a)&&(h&&(a&&h.__html==a.__html||h.__html===l.innerHTML)||(l.innerHTML=h&&h.__html||""));}if(H$2(l,d,y,o,e),h)u.__k=[];else if(P$2(l,v$6(k=u.props.children)?k:[k],u,i,t,o&&"foreignObject"!==_,r,f,r?r[0]:i.__k&&g$6(i,0),e),null!=r)for(k=r.length;k--;)null!=r[k]&&p$7(r[k]);e||("value"in d&&void 0!==(k=d.value)&&(k!==l.value||"progress"===_&&!k||"option"===_&&k!==y.value)&&T$3(l,"value",k,y.value,!1),"checked"in d&&void 0!==(k=d.checked)&&k!==l.checked&&T$3(l,"checked",k,y.checked,!1));}return l}function O$2(n,u,i){try{"function"==typeof n?n(u):n.current=u;}catch(n){l$7.__e(n,i);}}function q$7(n,u,i){var t,o;if(l$7.unmount&&l$7.unmount(n),(t=n.ref)&&(t.current&&t.current!==n.__e||O$2(t,null,u)),null!=(t=n.__c)){if(t.componentWillUnmount)try{t.componentWillUnmount();}catch(n){l$7.__e(n,u);}t.base=t.__P=null,n.__c=void 0;}if(t=n.__k)for(o=0;o<t.length;o++)t[o]&&q$7(t[o],u,i||"function"!=typeof n.type);i||null==n.__e||p$7(n.__e),n.__=n.__e=n.__d=void 0;}function B$3(n,l,u){return this.constructor(n,u)}function D$2(u,i,t){var o,r,f;l$7.__&&l$7.__(u,i),r=(o="function"==typeof t)?null:t&&t.__k||i.__k,f=[],L$2(i,u=(!o&&t||i).__k=y$3(k$8,null,[u]),r||c$5,c$5,void 0!==i.ownerSVGElement,!o&&t?[t]:r?null:i.firstChild?n$5.call(i.childNodes):null,f,!o&&t?t:r?r.__e:i.firstChild,o),M$2(f,u);}n$5=s$2.slice,l$7={__e:function(n,l,u,i){for(var t,o,r;l=l.__;)if((t=l.__c)&&!t.__)try{if((o=t.constructor)&&null!=o.getDerivedStateFromError&&(t.setState(o.getDerivedStateFromError(n)),r=t.__d),null!=t.componentDidCatch&&(t.componentDidCatch(n,i||{}),r=t.__d),r)return t.__E=t}catch(l){n=l;}throw n}},u$6=0,b$5.prototype.setState=function(n,l){var u;u=null!=this.__s&&this.__s!==this.state?this.__s:this.__s=h$6({},this.state),"function"==typeof n&&(n=n(h$6({},u),this.props)),n&&h$6(u,n),null!=n&&this.__v&&(l&&this._sb.push(l),w$6(this));},b$5.prototype.forceUpdate=function(n){this.__v&&(this.__e=!0,n&&this.__h.push(n),w$6(this));},b$5.prototype.render=k$8,t$6=[],r$6="function"==typeof Promise?Promise.prototype.then.bind(Promise.resolve()):setTimeout,f$5=function(n,l){return n.__v.__b-l.__v.__b},x$4.__r=0;

var n$4,l$6,u$5,i$2,o$3,r$5,f$4,e$6,c$4={},s$1=[],a$2=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,h$5=Array.isArray;function v$5(n,l){for(var u in l)n[u]=l[u];return n}function p$6(n){var l=n.parentNode;l&&l.removeChild(n);}function y$2(l,u,t){var i,o,r,f={};for(r in u)"key"==r?i=u[r]:"ref"==r?o=u[r]:f[r]=u[r];if(arguments.length>2&&(f.children=arguments.length>3?n$4.call(arguments,2):t),"function"==typeof l&&null!=l.defaultProps)for(r in l.defaultProps)void 0===f[r]&&(f[r]=l.defaultProps[r]);return d$4(l,f,i,o,null)}function d$4(n,t,i,o,r){var f={type:n,props:t,key:i,ref:o,__k:null,__:null,__b:0,__e:null,__d:void 0,__c:null,__h:null,constructor:void 0,__v:null==r?++u$5:r};return null==r&&null!=l$6.vnode&&l$6.vnode(f),f}function _$2(){return {current:null}}function k$7(n){return n.children}function b$4(n,l){this.props=n,this.context=l;}function g$5(n,l){if(null==l)return n.__?g$5(n.__,n.__.__k.indexOf(n)+1):null;for(var u;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e)return u.__e;return "function"==typeof n.type?g$5(n):null}function m$6(n){var l,u;if(null!=(n=n.__)&&null!=n.__c){for(n.__e=n.__c.base=null,l=0;l<n.__k.length;l++)if(null!=(u=n.__k[l])&&null!=u.__e){n.__e=n.__c.base=u.__e;break}return m$6(n)}}function w$5(n){(!n.__d&&(n.__d=!0)&&i$2.push(n)&&!x$3.__r++||o$3!==l$6.debounceRendering)&&((o$3=l$6.debounceRendering)||r$5)(x$3);}function x$3(){var n,l,u,t,o,r,e,c,s;for(i$2.sort(f$4);n=i$2.shift();)n.__d&&(l=i$2.length,t=void 0,o=void 0,r=void 0,c=(e=(u=n).__v).__e,(s=u.__P)&&(t=[],o=[],(r=v$5({},e)).__v=e.__v+1,L$1(s,e,r,u.__n,void 0!==s.ownerSVGElement,null!=e.__h?[c]:null,t,null==c?g$5(e):c,e.__h,o),M$1(t,e,o),e.__e!=c&&m$6(e)),i$2.length>l&&i$2.sort(f$4));x$3.__r=0;}function P$1(n,l,u,t,i,o,r,f,e,a,v){var p,y,_,b,g,m,w,x,P,S,H=0,I=t&&t.__k||s$1,T=I.length,j=T,z=l.length;for(u.__k=[],p=0;p<z;p++)null!=(b=u.__k[p]=null==(b=l[p])||"boolean"==typeof b||"function"==typeof b?null:"string"==typeof b||"number"==typeof b||"bigint"==typeof b?d$4(null,b,null,null,b):h$5(b)?d$4(k$7,{children:b},null,null,null):b.__b>0?d$4(b.type,b.props,b.key,b.ref?b.ref:null,b.__v):b)&&(b.__=u,b.__b=u.__b+1,-1===(x=A$3(b,I,w=p+H,j))?_=c$4:(_=I[x]||c$4,I[x]=void 0,j--),L$1(n,b,_,i,o,r,f,e,a,v),g=b.__e,(y=b.ref)&&_.ref!=y&&(_.ref&&O$1(_.ref,null,b),v.push(y,b.__c||g,b)),null!=g&&(null==m&&(m=g),S=!(P=_===c$4||null===_.__v)&&x===w,P?-1==x&&H--:x!==w&&(x===w+1?(H++,S=!0):x>w?j>z-w?(H+=x-w,S=!0):H--:H=x<w&&x==w-1?x-w:0),w=p+H,S=S||x==p&&!P,"function"!=typeof b.type||x===w&&_.__k!==b.__k?"function"==typeof b.type||S?void 0!==b.__d?(e=b.__d,b.__d=void 0):e=g.nextSibling:e=$$1(n,g,e):e=C$1(b,e,n),"function"==typeof u.type&&(u.__d=e)));for(u.__e=m,p=T;p--;)null!=I[p]&&("function"==typeof u.type&&null!=I[p].__e&&I[p].__e==u.__d&&(u.__d=I[p].__e.nextSibling),q$6(I[p],I[p]));}function C$1(n,l,u){for(var t,i=n.__k,o=0;i&&o<i.length;o++)(t=i[o])&&(t.__=n,l="function"==typeof t.type?C$1(t,l,u):$$1(u,t.__e,l));return l}function S(n,l){return l=l||[],null==n||"boolean"==typeof n||(h$5(n)?n.some(function(n){S(n,l);}):l.push(n)),l}function $$1(n,l,u){return null==u||u.parentNode!==n?n.insertBefore(l,null):l==u&&null!=l.parentNode||n.insertBefore(l,u),l.nextSibling}function A$3(n,l,u,t){var i=n.key,o=n.type,r=u-1,f=u+1,e=l[u];if(null===e||e&&i==e.key&&o===e.type)return u;if(t>(null!=e?1:0))for(;r>=0||f<l.length;){if(r>=0){if((e=l[r])&&i==e.key&&o===e.type)return r;r--;}if(f<l.length){if((e=l[f])&&i==e.key&&o===e.type)return f;f++;}}return -1}function H$1(n,l,u,t,i){var o;for(o in u)"children"===o||"key"===o||o in l||T$2(n,o,null,u[o],t);for(o in l)i&&"function"!=typeof l[o]||"children"===o||"key"===o||"value"===o||"checked"===o||u[o]===l[o]||T$2(n,o,l[o],u[o],t);}function I$1(n,l,u){"-"===l[0]?n.setProperty(l,null==u?"":u):n[l]=null==u?"":"number"!=typeof u||a$2.test(l)?u:u+"px";}function T$2(n,l,u,t,i){var o;n:if("style"===l)if("string"==typeof u)n.style.cssText=u;else {if("string"==typeof t&&(n.style.cssText=t=""),t)for(l in t)u&&l in u||I$1(n.style,l,"");if(u)for(l in u)t&&u[l]===t[l]||I$1(n.style,l,u[l]);}else if("o"===l[0]&&"n"===l[1])o=l!==(l=l.replace(/Capture$/,"")),l=l.toLowerCase()in n?l.toLowerCase().slice(2):l.slice(2),n.l||(n.l={}),n.l[l+o]=u,u?t||n.addEventListener(l,o?z$4:j$3,o):n.removeEventListener(l,o?z$4:j$3,o);else if("dangerouslySetInnerHTML"!==l){if(i)l=l.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if("width"!==l&&"height"!==l&&"href"!==l&&"list"!==l&&"form"!==l&&"tabIndex"!==l&&"download"!==l&&"rowSpan"!==l&&"colSpan"!==l&&l in n)try{n[l]=null==u?"":u;break n}catch(n){}"function"==typeof u||(null==u||!1===u&&"-"!==l[4]?n.removeAttribute(l):n.setAttribute(l,u));}}function j$3(n){return this.l[n.type+!1](l$6.event?l$6.event(n):n)}function z$4(n){return this.l[n.type+!0](l$6.event?l$6.event(n):n)}function L$1(n,u,t,i,o,r,f,e,c,s){var a,p,y,d,_,g,m,w,x,C,S,$,A,H,I,T=u.type;if(void 0!==u.constructor)return null;null!=t.__h&&(c=t.__h,e=u.__e=t.__e,u.__h=null,r=[e]),(a=l$6.__b)&&a(u);try{n:if("function"==typeof T){if(w=u.props,x=(a=T.contextType)&&i[a.__c],C=a?x?x.props.value:a.__:i,t.__c?m=(p=u.__c=t.__c).__=p.__E:("prototype"in T&&T.prototype.render?u.__c=p=new T(w,C):(u.__c=p=new b$4(w,C),p.constructor=T,p.render=B$2),x&&x.sub(p),p.props=w,p.state||(p.state={}),p.context=C,p.__n=i,y=p.__d=!0,p.__h=[],p._sb=[]),null==p.__s&&(p.__s=p.state),null!=T.getDerivedStateFromProps&&(p.__s==p.state&&(p.__s=v$5({},p.__s)),v$5(p.__s,T.getDerivedStateFromProps(w,p.__s))),d=p.props,_=p.state,p.__v=u,y)null==T.getDerivedStateFromProps&&null!=p.componentWillMount&&p.componentWillMount(),null!=p.componentDidMount&&p.__h.push(p.componentDidMount);else {if(null==T.getDerivedStateFromProps&&w!==d&&null!=p.componentWillReceiveProps&&p.componentWillReceiveProps(w,C),!p.__e&&(null!=p.shouldComponentUpdate&&!1===p.shouldComponentUpdate(w,p.__s,C)||u.__v===t.__v)){for(u.__v!==t.__v&&(p.props=w,p.state=p.__s,p.__d=!1),u.__e=t.__e,u.__k=t.__k,u.__k.forEach(function(n){n&&(n.__=u);}),S=0;S<p._sb.length;S++)p.__h.push(p._sb[S]);p._sb=[],p.__h.length&&f.push(p);break n}null!=p.componentWillUpdate&&p.componentWillUpdate(w,p.__s,C),null!=p.componentDidUpdate&&p.__h.push(function(){p.componentDidUpdate(d,_,g);});}if(p.context=C,p.props=w,p.__P=n,p.__e=!1,$=l$6.__r,A=0,"prototype"in T&&T.prototype.render){for(p.state=p.__s,p.__d=!1,$&&$(u),a=p.render(p.props,p.state,p.context),H=0;H<p._sb.length;H++)p.__h.push(p._sb[H]);p._sb=[];}else do{p.__d=!1,$&&$(u),a=p.render(p.props,p.state,p.context),p.state=p.__s;}while(p.__d&&++A<25);p.state=p.__s,null!=p.getChildContext&&(i=v$5(v$5({},i),p.getChildContext())),y||null==p.getSnapshotBeforeUpdate||(g=p.getSnapshotBeforeUpdate(d,_)),P$1(n,h$5(I=null!=a&&a.type===k$7&&null==a.key?a.props.children:a)?I:[I],u,t,i,o,r,f,e,c,s),p.base=u.__e,u.__h=null,p.__h.length&&f.push(p),m&&(p.__E=p.__=null);}else null==r&&u.__v===t.__v?(u.__k=t.__k,u.__e=t.__e):u.__e=N$1(t.__e,u,t,i,o,r,f,c,s);(a=l$6.diffed)&&a(u);}catch(n){u.__v=null,(c||null!=r)&&(u.__e=e,u.__h=!!c,r[r.indexOf(e)]=null),l$6.__e(n,u,t);}}function M$1(n,u,t){for(var i=0;i<t.length;i++)O$1(t[i],t[++i],t[++i]);l$6.__c&&l$6.__c(u,n),n.some(function(u){try{n=u.__h,u.__h=[],n.some(function(n){n.call(u);});}catch(n){l$6.__e(n,u.__v);}});}function N$1(l,u,t,i,o,r,f,e,s){var a,v,y,d=t.props,_=u.props,k=u.type,b=0;if("svg"===k&&(o=!0),null!=r)for(;b<r.length;b++)if((a=r[b])&&"setAttribute"in a==!!k&&(k?a.localName===k:3===a.nodeType)){l=a,r[b]=null;break}if(null==l){if(null===k)return document.createTextNode(_);l=o?document.createElementNS("http://www.w3.org/2000/svg",k):document.createElement(k,_.is&&_),r=null,e=!1;}if(null===k)d===_||e&&l.data===_||(l.data=_);else {if(r=r&&n$4.call(l.childNodes),v=(d=t.props||c$4).dangerouslySetInnerHTML,y=_.dangerouslySetInnerHTML,!e){if(null!=r)for(d={},b=0;b<l.attributes.length;b++)d[l.attributes[b].name]=l.attributes[b].value;(y||v)&&(y&&(v&&y.__html==v.__html||y.__html===l.innerHTML)||(l.innerHTML=y&&y.__html||""));}if(H$1(l,_,d,o,e),y)u.__k=[];else if(P$1(l,h$5(b=u.props.children)?b:[b],u,t,i,o&&"foreignObject"!==k,r,f,r?r[0]:t.__k&&g$5(t,0),e,s),null!=r)for(b=r.length;b--;)null!=r[b]&&p$6(r[b]);e||("value"in _&&void 0!==(b=_.value)&&(b!==l.value||"progress"===k&&!b||"option"===k&&b!==d.value)&&T$2(l,"value",b,d.value,!1),"checked"in _&&void 0!==(b=_.checked)&&b!==l.checked&&T$2(l,"checked",b,d.checked,!1));}return l}function O$1(n,u,t){try{"function"==typeof n?n(u):n.current=u;}catch(n){l$6.__e(n,t);}}function q$6(n,u,t){var i,o;if(l$6.unmount&&l$6.unmount(n),(i=n.ref)&&(i.current&&i.current!==n.__e||O$1(i,null,u)),null!=(i=n.__c)){if(i.componentWillUnmount)try{i.componentWillUnmount();}catch(n){l$6.__e(n,u);}i.base=i.__P=null,n.__c=void 0;}if(i=n.__k)for(o=0;o<i.length;o++)i[o]&&q$6(i[o],u,t||"function"!=typeof n.type);t||null==n.__e||p$6(n.__e),n.__=n.__e=n.__d=void 0;}function B$2(n,l,u){return this.constructor(n,u)}function D$1(u,t,i){var o,r,f,e;l$6.__&&l$6.__(u,t),r=(o="function"==typeof i)?null:i&&i.__k||t.__k,f=[],e=[],L$1(t,u=(!o&&i||t).__k=y$2(k$7,null,[u]),r||c$4,c$4,void 0!==t.ownerSVGElement,!o&&i?[i]:r?null:t.firstChild?n$4.call(t.childNodes):null,f,!o&&i?i:r?r.__e:t.firstChild,o,e),M$1(f,u,e);}function E$1(n,l){D$1(n,l,E$1);}function F$2(l,u,t){var i,o,r,f,e=v$5({},l.props);for(r in l.type&&l.type.defaultProps&&(f=l.type.defaultProps),u)"key"==r?i=u[r]:"ref"==r?o=u[r]:e[r]=void 0===u[r]&&void 0!==f?f[r]:u[r];return arguments.length>2&&(e.children=arguments.length>3?n$4.call(arguments,2):t),d$4(l.type,e,i||l.key,o||l.ref,null)}function G$1(n,l){var u={__c:l="__cC"+e$6++,__:n,Consumer:function(n,l){return n.children(l)},Provider:function(n){var u,t;return this.getChildContext||(u=[],(t={})[l]=this,this.getChildContext=function(){return t},this.shouldComponentUpdate=function(n){this.props.value!==n.value&&u.some(function(n){n.__e=!0,w$5(n);});},this.sub=function(n){u.push(n);var l=n.componentWillUnmount;n.componentWillUnmount=function(){u.splice(u.indexOf(n),1),l&&l.call(n);};}),n.children}};return u.Provider.__=u.Consumer.contextType=u}n$4=s$1.slice,l$6={__e:function(n,l,u,t){for(var i,o,r;l=l.__;)if((i=l.__c)&&!i.__)try{if((o=i.constructor)&&null!=o.getDerivedStateFromError&&(i.setState(o.getDerivedStateFromError(n)),r=i.__d),null!=i.componentDidCatch&&(i.componentDidCatch(n,t||{}),r=i.__d),r)return i.__E=i}catch(l){n=l;}throw n}},u$5=0,b$4.prototype.setState=function(n,l){var u;u=null!=this.__s&&this.__s!==this.state?this.__s:this.__s=v$5({},this.state),"function"==typeof n&&(n=n(v$5({},u),this.props)),n&&v$5(u,n),null!=n&&this.__v&&(l&&this._sb.push(l),w$5(this));},b$4.prototype.forceUpdate=function(n){this.__v&&(this.__e=!0,n&&this.__h.push(n),w$5(this));},b$4.prototype.render=k$7,i$2=[],r$5="function"==typeof Promise?Promise.prototype.then.bind(Promise.resolve()):setTimeout,f$4=function(n,l){return n.__v.__b-l.__v.__b},x$3.__r=0,e$6=0;

var t$5,r$4,u$4,i$1,o$2=0,f$3=[],c$3=[],e$5=l$6.__b,a$1=l$6.__r,v$4=l$6.diffed,l$5=l$6.__c,m$5=l$6.unmount;function d$3(t,u){l$6.__h&&l$6.__h(r$4,t,o$2||u),o$2=0;var i=r$4.__H||(r$4.__H={__:[],__h:[]});return t>=i.__.length&&i.__.push({__V:c$3}),i.__[t]}function h$4(n){return o$2=1,s(B$1,n)}function s(n,u,i){var o=d$3(t$5++,2);if(o.t=n,!o.__c&&(o.__=[i?i(u):B$1(void 0,u),function(n){var t=o.__N?o.__N[0]:o.__[0],r=o.t(t,n);t!==r&&(o.__N=[r,o.__[1]],o.__c.setState({}));}],o.__c=r$4,!r$4.u)){var f=function(n,t,r){if(!o.__c.__H)return !0;var u=o.__c.__H.__.filter(function(n){return n.__c});if(u.every(function(n){return !n.__N}))return !c||c.call(this,n,t,r);var i=!1;return u.forEach(function(n){if(n.__N){var t=n.__[0];n.__=n.__N,n.__N=void 0,t!==n.__[0]&&(i=!0);}}),!(!i&&o.__c.props===n)&&(!c||c.call(this,n,t,r))};r$4.u=!0;var c=r$4.shouldComponentUpdate,e=r$4.componentWillUpdate;r$4.componentWillUpdate=function(n,t,r){if(this.__e){var u=c;c=void 0,f(n,t,r),c=u;}e&&e.call(this,n,t,r);},r$4.shouldComponentUpdate=f;}return o.__N||o.__}function p$5(u,i){var o=d$3(t$5++,3);!l$6.__s&&z$3(o.__H,i)&&(o.__=u,o.i=i,r$4.__H.__h.push(o));}function y$1(u,i){var o=d$3(t$5++,4);!l$6.__s&&z$3(o.__H,i)&&(o.__=u,o.i=i,r$4.__h.push(o));}function _$1(n){return o$2=5,F$1(function(){return {current:n}},[])}function A$2(n,t,r){o$2=6,y$1(function(){return "function"==typeof n?(n(t()),function(){return n(null)}):n?(n.current=t(),function(){return n.current=null}):void 0},null==r?r:r.concat(n));}function F$1(n,r){var u=d$3(t$5++,7);return z$3(u.__H,r)?(u.__V=n(),u.i=r,u.__h=n,u.__V):u.__}function T$1(n,t){return o$2=8,F$1(function(){return n},t)}function q$5(n){var u=r$4.context[n.__c],i=d$3(t$5++,9);return i.c=n,u?(null==i.__&&(i.__=!0,u.sub(r$4)),u.props.value):n.__}function x$2(t,r){l$6.useDebugValue&&l$6.useDebugValue(r?r(t):t);}function V$1(){var n=d$3(t$5++,11);if(!n.__){for(var u=r$4.__v;null!==u&&!u.__m&&null!==u.__;)u=u.__;var i=u.__m||(u.__m=[0,0]);n.__="P"+i[0]+"-"+i[1]++;}return n.__}function b$3(){for(var t;t=f$3.shift();)if(t.__P&&t.__H)try{t.__H.__h.forEach(k$6),t.__H.__h.forEach(w$4),t.__H.__h=[];}catch(r){t.__H.__h=[],l$6.__e(r,t.__v);}}l$6.__b=function(n){r$4=null,e$5&&e$5(n);},l$6.__r=function(n){a$1&&a$1(n),t$5=0;var i=(r$4=n.__c).__H;i&&(u$4===r$4?(i.__h=[],r$4.__h=[],i.__.forEach(function(n){n.__N&&(n.__=n.__N),n.__V=c$3,n.__N=n.i=void 0;})):(i.__h.forEach(k$6),i.__h.forEach(w$4),i.__h=[],t$5=0)),u$4=r$4;},l$6.diffed=function(t){v$4&&v$4(t);var o=t.__c;o&&o.__H&&(o.__H.__h.length&&(1!==f$3.push(o)&&i$1===l$6.requestAnimationFrame||((i$1=l$6.requestAnimationFrame)||j$2)(b$3)),o.__H.__.forEach(function(n){n.i&&(n.__H=n.i),n.__V!==c$3&&(n.__=n.__V),n.i=void 0,n.__V=c$3;})),u$4=r$4=null;},l$6.__c=function(t,r){r.some(function(t){try{t.__h.forEach(k$6),t.__h=t.__h.filter(function(n){return !n.__||w$4(n)});}catch(u){r.some(function(n){n.__h&&(n.__h=[]);}),r=[],l$6.__e(u,t.__v);}}),l$5&&l$5(t,r);},l$6.unmount=function(t){m$5&&m$5(t);var r,u=t.__c;u&&u.__H&&(u.__H.__.forEach(function(n){try{k$6(n);}catch(n){r=n;}}),u.__H=void 0,r&&l$6.__e(r,u.__v));};var g$4="function"==typeof requestAnimationFrame;function j$2(n){var t,r=function(){clearTimeout(u),g$4&&cancelAnimationFrame(t),setTimeout(n);},u=setTimeout(r,100);g$4&&(t=requestAnimationFrame(r));}function k$6(n){var t=r$4,u=n.__c;"function"==typeof u&&(n.__c=void 0,u()),r$4=t;}function w$4(n){var t=r$4;n.__c=n.__(),r$4=t;}function z$3(n,t){return !n||n.length!==t.length||t.some(function(t,r){return t!==n[r]})}function B$1(n,t){return "function"==typeof t?t(n):t}

function g$3(n,t){for(var e in t)n[e]=t[e];return n}function C(n,t){for(var e in n)if("__source"!==e&&!(e in t))return !0;for(var r in t)if("__source"!==r&&n[r]!==t[r])return !0;return !1}function E(n,t){return n===t&&(0!==n||1/n==1/t)||n!=n&&t!=t}function w$3(n){this.props=n;}function x$1(n,e){function r(n){var t=this.props.ref,r=t==n.ref;return !r&&t&&(t.call?t(null):t.current=null),e?!e(this.props,n)||!r:C(this.props,n)}function u(e){return this.shouldComponentUpdate=r,y$2(n,e)}return u.displayName="Memo("+(n.displayName||n.name)+")",u.prototype.isReactComponent=!0,u.__f=!0,u}(w$3.prototype=new b$4).isPureReactComponent=!0,w$3.prototype.shouldComponentUpdate=function(n,t){return C(this.props,n)||C(this.state,t)};var R=l$6.__b;l$6.__b=function(n){n.type&&n.type.__f&&n.ref&&(n.props.ref=n.ref,n.ref=null),R&&R(n);};var N="undefined"!=typeof Symbol&&Symbol.for&&Symbol.for("react.forward_ref")||3911;function k$5(n){function t(t){var e=g$3({},t);return delete e.ref,n(e,t.ref||null)}return t.$$typeof=N,t.render=t,t.prototype.isReactComponent=t.__f=!0,t.displayName="ForwardRef("+(n.displayName||n.name)+")",t}var A$1=function(n,t){return null==n?null:S(S(n).map(t))},O={map:A$1,forEach:A$1,count:function(n){return n?S(n).length:0},only:function(n){var t=S(n);if(1!==t.length)throw "Children.only";return t[0]},toArray:S},T=l$6.__e;l$6.__e=function(n,t,e,r){if(n.then)for(var u,o=t;o=o.__;)if((u=o.__c)&&u.__c)return null==t.__e&&(t.__e=e.__e,t.__k=e.__k),u.__c(n,t);T(n,t,e,r);};var I=l$6.unmount;function L(n,t,e){return n&&(n.__c&&n.__c.__H&&(n.__c.__H.__.forEach(function(n){"function"==typeof n.__c&&n.__c();}),n.__c.__H=null),null!=(n=g$3({},n)).__c&&(n.__c.__P===e&&(n.__c.__P=t),n.__c=null),n.__k=n.__k&&n.__k.map(function(n){return L(n,t,e)})),n}function U(n,t,e){return n&&(n.__v=null,n.__k=n.__k&&n.__k.map(function(n){return U(n,t,e)}),n.__c&&n.__c.__P===t&&(n.__e&&e.insertBefore(n.__e,n.__d),n.__c.__e=!0,n.__c.__P=e)),n}function D(){this.__u=0,this.t=null,this.__b=null;}function F(n){var t=n.__.__c;return t&&t.__a&&t.__a(n)}function M(n){var e,r,u;function o(o){if(e||(e=n()).then(function(n){r=n.default||n;},function(n){u=n;}),u)throw u;if(!r)throw e;return y$2(r,o)}return o.displayName="Lazy",o.__f=!0,o}function V(){this.u=null,this.o=null;}l$6.unmount=function(n){var t=n.__c;t&&t.__R&&t.__R(),t&&!0===n.__h&&(n.type=null),I&&I(n);},(D.prototype=new b$4).__c=function(n,t){var e=t.__c,r=this;null==r.t&&(r.t=[]),r.t.push(e);var u=F(r.__v),o=!1,i=function(){o||(o=!0,e.__R=null,u?u(l):l());};e.__R=i;var l=function(){if(!--r.__u){if(r.state.__a){var n=r.state.__a;r.__v.__k[0]=U(n,n.__c.__P,n.__c.__O);}var t;for(r.setState({__a:r.__b=null});t=r.t.pop();)t.forceUpdate();}},c=!0===t.__h;r.__u++||c||r.setState({__a:r.__b=r.__v.__k[0]}),n.then(i,i);},D.prototype.componentWillUnmount=function(){this.t=[];},D.prototype.render=function(n,e){if(this.__b){if(this.__v.__k){var r=document.createElement("div"),o=this.__v.__k[0].__c;this.__v.__k[0]=L(this.__b,r,o.__O=o.__P);}this.__b=null;}var i=e.__a&&y$2(k$7,null,n.fallback);return i&&(i.__h=null),[y$2(k$7,null,e.__a?null:n.children),i]};var W=function(n,t,e){if(++e[1]===e[0]&&n.o.delete(t),n.props.revealOrder&&("t"!==n.props.revealOrder[0]||!n.o.size))for(e=n.u;e;){for(;e.length>3;)e.pop()();if(e[1]<e[0])break;n.u=e=e[2];}};function P(n){return this.getChildContext=function(){return n.context},n.children}function j$1(n){var e=this,r=n.i;e.componentWillUnmount=function(){D$1(null,e.l),e.l=null,e.i=null;},e.i&&e.i!==r&&e.componentWillUnmount(),n.__v?(e.l||(e.i=r,e.l={nodeType:1,parentNode:r,childNodes:[],appendChild:function(n){this.childNodes.push(n),e.i.appendChild(n);},insertBefore:function(n,t){this.childNodes.push(n),e.i.appendChild(n);},removeChild:function(n){this.childNodes.splice(this.childNodes.indexOf(n)>>>1,1),e.i.removeChild(n);}}),D$1(y$2(P,{context:e.context},n.__v),e.l)):e.l&&e.componentWillUnmount();}function z$2(n,e){var r=y$2(j$1,{__v:n,i:e});return r.containerInfo=e,r}(V.prototype=new b$4).__a=function(n){var t=this,e=F(t.__v),r=t.o.get(n);return r[0]++,function(u){var o=function(){t.props.revealOrder?(r.push(u),W(t,n,r)):u();};e?e(o):o();}},V.prototype.render=function(n){this.u=null,this.o=new Map;var t=S(n.children);n.revealOrder&&"b"===n.revealOrder[0]&&t.reverse();for(var e=t.length;e--;)this.o.set(t[e],this.u=[1,0,this.u]);return n.children},V.prototype.componentDidUpdate=V.prototype.componentDidMount=function(){var n=this;this.o.forEach(function(t,e){W(n,e,t);});};var B="undefined"!=typeof Symbol&&Symbol.for&&Symbol.for("react.element")||60103,H=/^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/,Z=/^on(Ani|Tra|Tou|BeforeInp|Compo)/,Y=/[A-Z0-9]/g,$="undefined"!=typeof document,q$4=function(n){return ("undefined"!=typeof Symbol&&"symbol"==typeof Symbol()?/fil|che|rad/:/fil|che|ra/).test(n)};function G(n,t,e){return null==t.__k&&(t.textContent=""),D$1(n,t),"function"==typeof e&&e(),n?n.__c:null}function J(n,t,e){return E$1(n,t),"function"==typeof e&&e(),n?n.__c:null}b$4.prototype.isReactComponent={},["componentWillMount","componentWillReceiveProps","componentWillUpdate"].forEach(function(t){Object.defineProperty(b$4.prototype,t,{configurable:!0,get:function(){return this["UNSAFE_"+t]},set:function(n){Object.defineProperty(this,t,{configurable:!0,writable:!0,value:n});}});});var K=l$6.event;function Q(){}function X(){return this.cancelBubble}function nn(){return this.defaultPrevented}l$6.event=function(n){return K&&(n=K(n)),n.persist=Q,n.isPropagationStopped=X,n.isDefaultPrevented=nn,n.nativeEvent=n};var tn,en={enumerable:!1,configurable:!0,get:function(){return this.class}},rn=l$6.vnode;l$6.vnode=function(n){"string"==typeof n.type&&function(n){var t=n.props,e=n.type,u={};for(var o in t){var i=t[o];if(!("value"===o&&"defaultValue"in t&&null==i||$&&"children"===o&&"noscript"===e||"class"===o||"className"===o)){var l=o.toLowerCase();"defaultValue"===o&&"value"in t&&null==t.value?o="value":"download"===o&&!0===i?i="":"ondoubleclick"===l?o="ondblclick":"onchange"!==l||"input"!==e&&"textarea"!==e||q$4(t.type)?"onfocus"===l?o="onfocusin":"onblur"===l?o="onfocusout":Z.test(o)?o=l:-1===e.indexOf("-")&&H.test(o)?o=o.replace(Y,"-$&").toLowerCase():null===i&&(i=void 0):l=o="oninput","oninput"===l&&u[o=l]&&(o="oninputCapture"),u[o]=i;}}"select"==e&&u.multiple&&Array.isArray(u.value)&&(u.value=S(t.children).forEach(function(n){n.props.selected=-1!=u.value.indexOf(n.props.value);})),"select"==e&&null!=u.defaultValue&&(u.value=S(t.children).forEach(function(n){n.props.selected=u.multiple?-1!=u.defaultValue.indexOf(n.props.value):u.defaultValue==n.props.value;})),t.class&&!t.className?(u.class=t.class,Object.defineProperty(u,"className",en)):(t.className&&!t.class||t.class&&t.className)&&(u.class=u.className=t.className),n.props=u;}(n),n.$$typeof=B,rn&&rn(n);};var un=l$6.__r;l$6.__r=function(n){un&&un(n),tn=n.__c;};var on=l$6.diffed;l$6.diffed=function(n){on&&on(n);var t=n.props,e=n.__e;null!=e&&"textarea"===n.type&&"value"in t&&t.value!==e.value&&(e.value=null==t.value?"":t.value),tn=null;};var ln={ReactCurrentDispatcher:{current:{readContext:function(n){return tn.__n[n.__c].props.value}}}},cn="17.0.2";function fn(n){return y$2.bind(null,n)}function an(n){return !!n&&n.$$typeof===B}function sn(n){return an(n)?F$2.apply(null,arguments):n}function hn(n){return !!n.__k&&(D$1(null,n),!0)}function vn(n){return n&&(n.base||1===n.nodeType&&n)||null}var dn=function(n,t){return n(t)},pn=function(n,t){return n(t)},mn=k$7;function yn(n){n();}function _n(n){return n}function bn(){return [!1,yn]}var Sn=y$1;function gn(n,t){var e=t(),r=h$4({h:{__:e,v:t}}),u=r[0].h,o=r[1];return y$1(function(){u.__=e,u.v=t,E(u.__,t())||o({h:u});},[n,e,t]),p$5(function(){return E(u.__,u.v())||o({h:u}),n(function(){E(u.__,u.v())||o({h:u});})},[n]),e}var Cn={useState:h$4,useId:V$1,useReducer:s,useEffect:p$5,useLayoutEffect:y$1,useInsertionEffect:Sn,useTransition:bn,useDeferredValue:_n,useSyncExternalStore:gn,startTransition:yn,useRef:_$1,useImperativeHandle:A$2,useMemo:F$1,useCallback:T$1,useContext:q$5,useDebugValue:x$2,version:"17.0.2",Children:O,render:G,hydrate:J,unmountComponentAtNode:hn,createPortal:z$2,createElement:y$2,createContext:G$1,createFactory:fn,cloneElement:sn,createRef:_$2,Fragment:k$7,isValidElement:an,findDOMNode:vn,Component:b$4,PureComponent:w$3,memo:x$1,forwardRef:k$5,flushSync:pn,unstable_batchedUpdates:dn,StrictMode:mn,Suspense:D,SuspenseList:V,lazy:M,__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED:ln};

var shim$1 = {exports: {}};

var useSyncExternalStoreShim_production_min$1 = {};

/**
 * @license React
 * use-sync-external-store-shim.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var e$4=Cn;function h$3(a,b){return a===b&&(0!==a||1/a===1/b)||a!==a&&b!==b}var k$4="function"===typeof Object.is?Object.is:h$3,l$4=e$4.useState,m$4=e$4.useEffect,n$3=e$4.useLayoutEffect,p$4=e$4.useDebugValue;function q$3(a,b){var d=b(),f=l$4({inst:{value:d,getSnapshot:b}}),c=f[0].inst,g=f[1];n$3(function(){c.value=d;c.getSnapshot=b;r$3(c)&&g({inst:c});},[a,d,b]);m$4(function(){r$3(c)&&g({inst:c});return a(function(){r$3(c)&&g({inst:c});})},[a]);p$4(d);return d}
function r$3(a){var b=a.getSnapshot;a=a.value;try{var d=b();return !k$4(a,d)}catch(f){return !0}}function t$4(a,b){return b()}var u$3="undefined"===typeof window||"undefined"===typeof window.document||"undefined"===typeof window.document.createElement?t$4:q$3;useSyncExternalStoreShim_production_min$1.useSyncExternalStore=void 0!==e$4.useSyncExternalStore?e$4.useSyncExternalStore:u$3;

{
  shim$1.exports = useSyncExternalStoreShim_production_min$1;
}

var shimExports$1 = shim$1.exports;

shimExports$1.useSyncExternalStore;

var withSelector = {exports: {}};

var withSelector_production_min = {};

var shim = {exports: {}};

var useSyncExternalStoreShim_production_min = {};

/**
 * @license React
 * use-sync-external-store-shim.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var e$3=Cn;function h$1$1(a,b){return a===b&&(0!==a||1/a===1/b)||a!==a&&b!==b}var k$3="function"===typeof Object.is?Object.is:h$1$1,l$3=e$3.useState,m$3=e$3.useEffect,n$1$1=e$3.useLayoutEffect,p$1$1=e$3.useDebugValue;function q$1$1(a,b){var d=b(),f=l$3({inst:{value:d,getSnapshot:b}}),c=f[0].inst,g=f[1];n$1$1(function(){c.value=d;c.getSnapshot=b;r$1$1(c)&&g({inst:c});},[a,d,b]);m$3(function(){r$1$1(c)&&g({inst:c});return a(function(){r$1$1(c)&&g({inst:c});})},[a]);p$1$1(d);return d}
function r$1$1(a){var b=a.getSnapshot;a=a.value;try{var d=b();return !k$3(a,d)}catch(f){return !0}}function t$1$1(a,b){return b()}var u$1$1="undefined"===typeof window||"undefined"===typeof window.document||"undefined"===typeof window.document.createElement?t$1$1:q$1$1;useSyncExternalStoreShim_production_min.useSyncExternalStore=void 0!==e$3.useSyncExternalStore?e$3.useSyncExternalStore:u$1$1;

{
  shim.exports = useSyncExternalStoreShim_production_min;
}

var shimExports = shim.exports;

/**
 * @license React
 * use-sync-external-store-shim/with-selector.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var h$2=Cn,n$2=shimExports;function p$3(a,b){return a===b&&(0!==a||1/a===1/b)||a!==a&&b!==b}var q$2="function"===typeof Object.is?Object.is:p$3,r$2=n$2.useSyncExternalStore,t$3=h$2.useRef,u$2=h$2.useEffect,v$3=h$2.useMemo,w$2=h$2.useDebugValue;
withSelector_production_min.useSyncExternalStoreWithSelector=function(a,b,e,l,g){var c=t$3(null);if(null===c.current){var f={hasValue:!1,value:null};c.current=f;}else f=c.current;c=v$3(function(){function a(a){if(!c){c=!0;d=a;a=l(a);if(void 0!==g&&f.hasValue){var b=f.value;if(g(b,a))return k=b}return k=a}b=k;if(q$2(d,a))return b;var e=l(a);if(void 0!==g&&g(b,e))return b;d=a;return k=e}var c=!1,d,k,m=void 0===e?null:e;return [function(){return a(b())},null===m?void 0:function(){return a(m())}]},[b,e,l,g]);var d=r$2(a,c[0],c[1]);
u$2(function(){f.hasValue=!0;f.value=d;},[d]);w$2(d);return d};

{
  withSelector.exports = withSelector_production_min;
}

var withSelectorExports = withSelector.exports;

var useSyncExternalStoreWithSelector$1 = withSelectorExports.useSyncExternalStoreWithSelector;

// Default to a dummy "batch" implementation that just runs the callback
function defaultNoopBatch(callback) {
  callback();
}

let batch = defaultNoopBatch; // Allow injecting another batching function later

const setBatch = newBatch => batch = newBatch; // Supply a getter just to skip dealing with ESM bindings

const getBatch = () => batch;

const ContextKey = Symbol.for(`react-redux-context-${cn}`);
const gT = globalThis;

function getContext() {
  let realContext = gT[ContextKey];

  if (!realContext) {
    realContext = G$1(null);

    gT[ContextKey] = realContext;
  }

  return realContext;
}

const ReactReduxContext = /*#__PURE__*/new Proxy({}, /*#__PURE__*/new Proxy({}, {
  get(_, handler) {
    const target = getContext(); // @ts-ignore

    return (_target, ...args) => Reflect[handler](target, ...args);
  }

}));

/**
 * Hook factory, which creates a `useReduxContext` hook bound to a given context. This is a low-level
 * hook that you should usually not need to call directly.
 *
 * @param {React.Context} [context=ReactReduxContext] Context passed to your `<Provider>`.
 * @returns {Function} A `useReduxContext` hook bound to the specified context.
 */
function createReduxContextHook(context = ReactReduxContext) {
  return function useReduxContext() {
    const contextValue = q$5(context);

    return contextValue;
  };
}
/**
 * A hook to access the value of the `ReactReduxContext`. This is a low-level
 * hook that you should usually not need to call directly.
 *
 * @returns {any} the value of the `ReactReduxContext`
 *
 * @example
 *
 * import React from 'react'
 * import { useReduxContext } from 'react-redux'
 *
 * export const CounterComponent = () => {
 *   const { store } = useReduxContext()
 *   return <div>{store.getState()}</div>
 * }
 */

const useReduxContext = /*#__PURE__*/createReduxContextHook();

const notInitialized = () => {
  throw new Error('uSES not initialized!');
};

let useSyncExternalStoreWithSelector = notInitialized;
const initializeUseSelector = fn => {
  useSyncExternalStoreWithSelector = fn;
};

const refEquality = (a, b) => a === b;
/**
 * Hook factory, which creates a `useSelector` hook bound to a given context.
 *
 * @param {React.Context} [context=ReactReduxContext] Context passed to your `<Provider>`.
 * @returns {Function} A `useSelector` hook bound to the specified context.
 */


function createSelectorHook(context = ReactReduxContext) {
  const useReduxContext$1 = context === ReactReduxContext ? useReduxContext : createReduxContextHook(context);
  return function useSelector(selector, equalityFnOrOptions = {}) {
    const {
      equalityFn = refEquality,
      stabilityCheck = undefined,
      noopCheck = undefined
    } = typeof equalityFnOrOptions === 'function' ? {
      equalityFn: equalityFnOrOptions
    } : equalityFnOrOptions;

    const {
      store,
      subscription,
      getServerState,
      stabilityCheck: globalStabilityCheck,
      noopCheck: globalNoopCheck
    } = useReduxContext$1();
    _$1(true);
    const wrappedSelector = T$1({
      [selector.name](state) {
        const selected = selector(state);

        return selected;
      }

    }[selector.name], [selector, globalStabilityCheck, stabilityCheck]);
    const selectedState = useSyncExternalStoreWithSelector(subscription.addNestedSub, store.getState, getServerState || store.getState, wrappedSelector, equalityFn);
    x$2(selectedState);
    return selectedState;
  };
}
/**
 * A hook to access the redux store's state. This hook takes a selector function
 * as an argument. The selector is called with the store state.
 *
 * This hook takes an optional equality comparison function as the second parameter
 * that allows you to customize the way the selected state is compared to determine
 * whether the component needs to be re-rendered.
 *
 * @param {Function} selector the selector function
 * @param {Function=} equalityFn the function that will be used to determine equality
 *
 * @returns {any} the selected state
 *
 * @example
 *
 * import React from 'react'
 * import { useSelector } from 'react-redux'
 *
 * export const CounterComponent = () => {
 *   const counter = useSelector(state => state.counter)
 *   return <div>{counter}</div>
 * }
 */

const useSelector = /*#__PURE__*/createSelectorHook();

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var reactIs$2 = {exports: {}};

var reactIs_production_min$1 = {};

/** @license React v16.13.1
 * react-is.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var b$2="function"===typeof Symbol&&Symbol.for,c$2=b$2?Symbol.for("react.element"):60103,d$2=b$2?Symbol.for("react.portal"):60106,e$2=b$2?Symbol.for("react.fragment"):60107,f$2=b$2?Symbol.for("react.strict_mode"):60108,g$2=b$2?Symbol.for("react.profiler"):60114,h$1=b$2?Symbol.for("react.provider"):60109,k$2=b$2?Symbol.for("react.context"):60110,l$2=b$2?Symbol.for("react.async_mode"):60111,m$2=b$2?Symbol.for("react.concurrent_mode"):60111,n$1=b$2?Symbol.for("react.forward_ref"):60112,p$2=b$2?Symbol.for("react.suspense"):60113,q$1=b$2?
Symbol.for("react.suspense_list"):60120,r$1=b$2?Symbol.for("react.memo"):60115,t$2=b$2?Symbol.for("react.lazy"):60116,v$2=b$2?Symbol.for("react.block"):60121,w$1=b$2?Symbol.for("react.fundamental"):60117,x=b$2?Symbol.for("react.responder"):60118,y=b$2?Symbol.for("react.scope"):60119;
function z$1(a){if("object"===typeof a&&null!==a){var u=a.$$typeof;switch(u){case c$2:switch(a=a.type,a){case l$2:case m$2:case e$2:case g$2:case f$2:case p$2:return a;default:switch(a=a&&a.$$typeof,a){case k$2:case n$1:case t$2:case r$1:case h$1:return a;default:return u}}case d$2:return u}}}function A(a){return z$1(a)===m$2}reactIs_production_min$1.AsyncMode=l$2;reactIs_production_min$1.ConcurrentMode=m$2;reactIs_production_min$1.ContextConsumer=k$2;reactIs_production_min$1.ContextProvider=h$1;reactIs_production_min$1.Element=c$2;reactIs_production_min$1.ForwardRef=n$1;reactIs_production_min$1.Fragment=e$2;reactIs_production_min$1.Lazy=t$2;reactIs_production_min$1.Memo=r$1;reactIs_production_min$1.Portal=d$2;
reactIs_production_min$1.Profiler=g$2;reactIs_production_min$1.StrictMode=f$2;reactIs_production_min$1.Suspense=p$2;reactIs_production_min$1.isAsyncMode=function(a){return A(a)||z$1(a)===l$2};reactIs_production_min$1.isConcurrentMode=A;reactIs_production_min$1.isContextConsumer=function(a){return z$1(a)===k$2};reactIs_production_min$1.isContextProvider=function(a){return z$1(a)===h$1};reactIs_production_min$1.isElement=function(a){return "object"===typeof a&&null!==a&&a.$$typeof===c$2};reactIs_production_min$1.isForwardRef=function(a){return z$1(a)===n$1};reactIs_production_min$1.isFragment=function(a){return z$1(a)===e$2};reactIs_production_min$1.isLazy=function(a){return z$1(a)===t$2};
reactIs_production_min$1.isMemo=function(a){return z$1(a)===r$1};reactIs_production_min$1.isPortal=function(a){return z$1(a)===d$2};reactIs_production_min$1.isProfiler=function(a){return z$1(a)===g$2};reactIs_production_min$1.isStrictMode=function(a){return z$1(a)===f$2};reactIs_production_min$1.isSuspense=function(a){return z$1(a)===p$2};
reactIs_production_min$1.isValidElementType=function(a){return "string"===typeof a||"function"===typeof a||a===e$2||a===m$2||a===g$2||a===f$2||a===p$2||a===q$1||"object"===typeof a&&null!==a&&(a.$$typeof===t$2||a.$$typeof===r$1||a.$$typeof===h$1||a.$$typeof===k$2||a.$$typeof===n$1||a.$$typeof===w$1||a.$$typeof===x||a.$$typeof===y||a.$$typeof===v$2)};reactIs_production_min$1.typeOf=z$1;

{
  reactIs$2.exports = reactIs_production_min$1;
}

var reactIsExports$1 = reactIs$2.exports;
var __jsenv_default_import__ = /*@__PURE__*/getDefaultExportFromCjs(reactIsExports$1);

reactIsExports$1.AsyncMode;
reactIsExports$1.ConcurrentMode;
reactIsExports$1.ContextConsumer;
reactIsExports$1.ContextProvider;
reactIsExports$1.Element;
reactIsExports$1.ForwardRef;
reactIsExports$1.Fragment;
reactIsExports$1.Lazy;
reactIsExports$1.Memo;
reactIsExports$1.Portal;
reactIsExports$1.Profiler;
reactIsExports$1.StrictMode;
reactIsExports$1.Suspense;
reactIsExports$1.isAsyncMode;
reactIsExports$1.isConcurrentMode;
reactIsExports$1.isContextConsumer;
reactIsExports$1.isContextProvider;
reactIsExports$1.isElement;
reactIsExports$1.isForwardRef;
reactIsExports$1.isFragment;
reactIsExports$1.isLazy;
reactIsExports$1.isMemo;
reactIsExports$1.isPortal;
reactIsExports$1.isProfiler;
reactIsExports$1.isStrictMode;
reactIsExports$1.isSuspense;
reactIsExports$1.isValidElementType;
reactIsExports$1.typeOf;

var reactIs$1 = __jsenv_default_import__;
var FORWARD_REF_STATICS = {
  '$$typeof': true,
  render: true,
  defaultProps: true,
  displayName: true,
  propTypes: true
};
var MEMO_STATICS = {
  '$$typeof': true,
  compare: true,
  defaultProps: true,
  displayName: true,
  propTypes: true,
  type: true
};
var TYPE_STATICS = {};
TYPE_STATICS[reactIs$1.ForwardRef] = FORWARD_REF_STATICS;
TYPE_STATICS[reactIs$1.Memo] = MEMO_STATICS;

var reactIs = {exports: {}};

var reactIs_production_min = {};

/**
 * @license React
 * react-is.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var b$1=Symbol.for("react.element"),c$1=Symbol.for("react.portal"),d$1=Symbol.for("react.fragment"),e$1=Symbol.for("react.strict_mode"),f$1=Symbol.for("react.profiler"),g$1=Symbol.for("react.provider"),h=Symbol.for("react.context"),k$1=Symbol.for("react.server_context"),l$1=Symbol.for("react.forward_ref"),m$1=Symbol.for("react.suspense"),n=Symbol.for("react.suspense_list"),p$1=Symbol.for("react.memo"),q=Symbol.for("react.lazy"),t$1=Symbol.for("react.offscreen"),u$1;u$1=Symbol.for("react.module.reference");
function v$1(a){if("object"===typeof a&&null!==a){var r=a.$$typeof;switch(r){case b$1:switch(a=a.type,a){case d$1:case f$1:case e$1:case m$1:case n:return a;default:switch(a=a&&a.$$typeof,a){case k$1:case h:case l$1:case q:case p$1:case g$1:return a;default:return r}}case c$1:return r}}}reactIs_production_min.ContextConsumer=h;reactIs_production_min.ContextProvider=g$1;reactIs_production_min.Element=b$1;reactIs_production_min.ForwardRef=l$1;reactIs_production_min.Fragment=d$1;reactIs_production_min.Lazy=q;reactIs_production_min.Memo=p$1;reactIs_production_min.Portal=c$1;reactIs_production_min.Profiler=f$1;reactIs_production_min.StrictMode=e$1;reactIs_production_min.Suspense=m$1;
reactIs_production_min.SuspenseList=n;reactIs_production_min.isAsyncMode=function(){return !1};reactIs_production_min.isConcurrentMode=function(){return !1};reactIs_production_min.isContextConsumer=function(a){return v$1(a)===h};reactIs_production_min.isContextProvider=function(a){return v$1(a)===g$1};reactIs_production_min.isElement=function(a){return "object"===typeof a&&null!==a&&a.$$typeof===b$1};reactIs_production_min.isForwardRef=function(a){return v$1(a)===l$1};reactIs_production_min.isFragment=function(a){return v$1(a)===d$1};reactIs_production_min.isLazy=function(a){return v$1(a)===q};reactIs_production_min.isMemo=function(a){return v$1(a)===p$1};
reactIs_production_min.isPortal=function(a){return v$1(a)===c$1};reactIs_production_min.isProfiler=function(a){return v$1(a)===f$1};reactIs_production_min.isStrictMode=function(a){return v$1(a)===e$1};reactIs_production_min.isSuspense=function(a){return v$1(a)===m$1};reactIs_production_min.isSuspenseList=function(a){return v$1(a)===n};
reactIs_production_min.isValidElementType=function(a){return "string"===typeof a||"function"===typeof a||a===d$1||a===f$1||a===e$1||a===m$1||a===n||a===t$1||"object"===typeof a&&null!==a&&(a.$$typeof===q||a.$$typeof===p$1||a.$$typeof===g$1||a.$$typeof===h||a.$$typeof===l$1||a.$$typeof===u$1||void 0!==a.getModuleId)?!0:!1};reactIs_production_min.typeOf=v$1;

{
  reactIs.exports = reactIs_production_min;
}

var reactIsExports = reactIs.exports;

reactIsExports.ContextConsumer;
reactIsExports.ContextProvider;
reactIsExports.Element;
reactIsExports.ForwardRef;
reactIsExports.Fragment;
reactIsExports.Lazy;
reactIsExports.Memo;
reactIsExports.Portal;
reactIsExports.Profiler;
reactIsExports.StrictMode;
reactIsExports.Suspense;
reactIsExports.SuspenseList;
reactIsExports.isAsyncMode;
reactIsExports.isConcurrentMode;
reactIsExports.isContextConsumer;
reactIsExports.isContextProvider;
reactIsExports.isElement;
reactIsExports.isForwardRef;
reactIsExports.isFragment;
reactIsExports.isLazy;
reactIsExports.isMemo;
reactIsExports.isPortal;
reactIsExports.isProfiler;
reactIsExports.isStrictMode;
reactIsExports.isSuspense;
reactIsExports.isSuspenseList;
reactIsExports.isValidElementType;
reactIsExports.typeOf;

// well as nesting subscriptions of descendant components, so that we can ensure the
// ancestor components re-render before descendants

function createListenerCollection() {
  const batch = getBatch();
  let first = null;
  let last = null;
  return {
    clear() {
      first = null;
      last = null;
    },

    notify() {
      batch(() => {
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

const nullListeners = {
  notify() {},

  get: () => []
};
function createSubscription(store, parentSub) {
  let unsubscribe;
  let listeners = nullListeners;

  function addNestedSub(listener) {
    trySubscribe();
    return listeners.subscribe(listener);
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
    return Boolean(unsubscribe);
  }

  function trySubscribe() {
    if (!unsubscribe) {
      unsubscribe = parentSub ? parentSub.addNestedSub(handleChangeWrapper) : store.subscribe(handleChangeWrapper);
      listeners = createListenerCollection();
    }
  }

  function tryUnsubscribe() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = undefined;
      listeners.clear();
      listeners = nullListeners;
    }
  }

  const subscription = {
    addNestedSub,
    notifyNestedSubs,
    handleChangeWrapper,
    isSubscribed,
    trySubscribe,
    tryUnsubscribe,
    getListeners: () => listeners
  };
  return subscription;
}

// To get around it, we can conditionally useEffect on the server (no-op) and
// useLayoutEffect in the browser. We need useLayoutEffect to ensure the store
// subscription callback always has the selector from the latest render commit
// available, otherwise a store update may happen between render and the effect,
// which may cause missed updates; we also must ensure the store subscription
// is created synchronously, otherwise a store update may occur before the
// subscription is created and an inconsistent state may be observed
// Matches logic in React's `shared/ExecutionEnvironment` file

const canUseDOM = !!(typeof window !== 'undefined' && typeof window.document !== 'undefined' && typeof window.document.createElement !== 'undefined');
const useIsomorphicLayoutEffect = canUseDOM ? y$1 : p$5;

function Provider({
  store,
  context,
  children,
  serverState,
  stabilityCheck = 'once',
  noopCheck = 'once'
}) {
  const contextValue = F$1(() => {
    const subscription = createSubscription(store);
    return {
      store,
      subscription,
      getServerState: serverState ? () => serverState : undefined,
      stabilityCheck,
      noopCheck
    };
  }, [store, serverState, stabilityCheck, noopCheck]);
  const previousState = F$1(() => store.getState(), [store]);
  useIsomorphicLayoutEffect(() => {
    const {
      subscription
    } = contextValue;
    subscription.onStateChange = subscription.notifyNestedSubs;
    subscription.trySubscribe();

    if (previousState !== store.getState()) {
      subscription.notifyNestedSubs();
    }

    return () => {
      subscription.tryUnsubscribe();
      subscription.onStateChange = undefined;
    };
  }, [contextValue, previousState]);
  const Context = context || ReactReduxContext; // @ts-ignore 'AnyAction' is assignable to the constraint of type 'A', but 'A' could be instantiated with a different subtype

  return /*#__PURE__*/Cn.createElement(Context.Provider, {
    value: contextValue
  }, children);
}

/**
 * Hook factory, which creates a `useStore` hook bound to a given context.
 *
 * @param {React.Context} [context=ReactReduxContext] Context passed to your `<Provider>`.
 * @returns {Function} A `useStore` hook bound to the specified context.
 */

function createStoreHook(context = ReactReduxContext) {
  const useReduxContext$1 = // @ts-ignore
  context === ReactReduxContext ? useReduxContext : // @ts-ignore
  createReduxContextHook(context);
  return function useStore() {
    const {
      store
    } = useReduxContext$1(); // @ts-ignore

    return store;
  };
}
/**
 * A hook to access the redux store.
 *
 * @returns {any} the redux store
 *
 * @example
 *
 * import React from 'react'
 * import { useStore } from 'react-redux'
 *
 * export const ExampleComponent = () => {
 *   const store = useStore()
 *   return <div>{store.getState()}</div>
 * }
 */

const useStore = /*#__PURE__*/createStoreHook();

/**
 * Hook factory, which creates a `useDispatch` hook bound to a given context.
 *
 * @param {React.Context} [context=ReactReduxContext] Context passed to your `<Provider>`.
 * @returns {Function} A `useDispatch` hook bound to the specified context.
 */

function createDispatchHook(context = ReactReduxContext) {
  const useStore$1 = // @ts-ignore
  context === ReactReduxContext ? useStore : createStoreHook(context);
  return function useDispatch() {
    const store = useStore$1(); // @ts-ignore

    return store.dispatch;
  };
}
/**
 * A hook to access the redux `dispatch` function.
 *
 * @returns {any|function} redux store's `dispatch` function
 *
 * @example
 *
 * import React, { useCallback } from 'react'
 * import { useDispatch } from 'react-redux'
 *
 * export const CounterComponent = ({ value }) => {
 *   const dispatch = useDispatch()
 *   const increaseCounter = useCallback(() => dispatch({ type: 'increase-counter' }), [])
 *   return (
 *     <div>
 *       <span>{value}</span>
 *       <button onClick={increaseCounter}>Increase counter</button>
 *     </div>
 *   )
 * }
 */

const useDispatch = /*#__PURE__*/createDispatchHook();

// The primary entry point assumes we're working with standard ReactDOM/RN, but
// older versions that do not include `useSyncExternalStore` (React 16.9 - 17.x).
// Because of that, the useSyncExternalStore compat shim is needed.
initializeUseSelector(useSyncExternalStoreWithSelector$1);
// with standard React renderers (ReactDOM, React Native)

setBatch(dn);

/**
 * Adapted from React: https://github.com/facebook/react/blob/master/packages/shared/formatProdErrorMessage.js
 *
 * Do not require this module directly! Use normal throw error calls. These messages will be replaced with error codes
 * during build.
 * @param {number} code
 */
function formatProdErrorMessage(code) {
  return "Minified Redux error #" + code + "; visit https://redux.js.org/Errors?code=" + code + " for the full message or " + 'use the non-minified dev environment for full errors. ';
}

// Inlined version of the `symbol-observable` polyfill
var $$observable = (function () {
  return typeof Symbol === 'function' && Symbol.observable || '@@observable';
})();

/**
 * These are private action types reserved by Redux.
 * For any unknown actions, you must return the current state.
 * If the current state is undefined, you must return the initial state.
 * Do not reference these action types directly in your code.
 */
var randomString = function randomString() {
  return Math.random().toString(36).substring(7).split('').join('.');
};

var ActionTypes = {
  INIT: "@@redux/INIT" + randomString(),
  REPLACE: "@@redux/REPLACE" + randomString(),
  PROBE_UNKNOWN_ACTION: function PROBE_UNKNOWN_ACTION() {
    return "@@redux/PROBE_UNKNOWN_ACTION" + randomString();
  }
};

/**
 * @param {any} obj The object to inspect.
 * @returns {boolean} True if the argument appears to be a plain object.
 */
function isPlainObject(obj) {
  if (typeof obj !== 'object' || obj === null) return false;
  var proto = obj;

  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }

  return Object.getPrototypeOf(obj) === proto;
}

/**
 * @deprecated
 *
 * **We recommend using the `configureStore` method
 * of the `@reduxjs/toolkit` package**, which replaces `createStore`.
 *
 * Redux Toolkit is our recommended approach for writing Redux logic today,
 * including store setup, reducers, data fetching, and more.
 *
 * **For more details, please read this Redux docs page:**
 * **https://redux.js.org/introduction/why-rtk-is-redux-today**
 *
 * `configureStore` from Redux Toolkit is an improved version of `createStore` that
 * simplifies setup and helps avoid common bugs.
 *
 * You should not be using the `redux` core package by itself today, except for learning purposes.
 * The `createStore` method from the core `redux` package will not be removed, but we encourage
 * all users to migrate to using Redux Toolkit for all Redux code.
 *
 * If you want to use `createStore` without this visual deprecation warning, use
 * the `legacy_createStore` import instead:
 *
 * `import { legacy_createStore as createStore} from 'redux'`
 *
 */

function createStore(reducer, preloadedState, enhancer) {
  var _ref2;

  if (typeof preloadedState === 'function' && typeof enhancer === 'function' || typeof enhancer === 'function' && typeof arguments[3] === 'function') {
    throw new Error(formatProdErrorMessage(0) );
  }

  if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
    enhancer = preloadedState;
    preloadedState = undefined;
  }

  if (typeof enhancer !== 'undefined') {
    if (typeof enhancer !== 'function') {
      throw new Error(formatProdErrorMessage(1) );
    }

    return enhancer(createStore)(reducer, preloadedState);
  }

  if (typeof reducer !== 'function') {
    throw new Error(formatProdErrorMessage(2) );
  }

  var currentReducer = reducer;
  var currentState = preloadedState;
  var currentListeners = [];
  var nextListeners = currentListeners;
  var isDispatching = false;
  /**
   * This makes a shallow copy of currentListeners so we can use
   * nextListeners as a temporary list while dispatching.
   *
   * This prevents any bugs around consumers calling
   * subscribe/unsubscribe in the middle of a dispatch.
   */

  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice();
    }
  }
  /**
   * Reads the state tree managed by the store.
   *
   * @returns {any} The current state tree of your application.
   */


  function getState() {
    if (isDispatching) {
      throw new Error(formatProdErrorMessage(3) );
    }

    return currentState;
  }
  /**
   * Adds a change listener. It will be called any time an action is dispatched,
   * and some part of the state tree may potentially have changed. You may then
   * call `getState()` to read the current state tree inside the callback.
   *
   * You may call `dispatch()` from a change listener, with the following
   * caveats:
   *
   * 1. The subscriptions are snapshotted just before every `dispatch()` call.
   * If you subscribe or unsubscribe while the listeners are being invoked, this
   * will not have any effect on the `dispatch()` that is currently in progress.
   * However, the next `dispatch()` call, whether nested or not, will use a more
   * recent snapshot of the subscription list.
   *
   * 2. The listener should not expect to see all state changes, as the state
   * might have been updated multiple times during a nested `dispatch()` before
   * the listener is called. It is, however, guaranteed that all subscribers
   * registered before the `dispatch()` started will be called with the latest
   * state by the time it exits.
   *
   * @param {Function} listener A callback to be invoked on every dispatch.
   * @returns {Function} A function to remove this change listener.
   */


  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error(formatProdErrorMessage(4) );
    }

    if (isDispatching) {
      throw new Error(formatProdErrorMessage(5) );
    }

    var isSubscribed = true;
    ensureCanMutateNextListeners();
    nextListeners.push(listener);
    return function unsubscribe() {
      if (!isSubscribed) {
        return;
      }

      if (isDispatching) {
        throw new Error(formatProdErrorMessage(6) );
      }

      isSubscribed = false;
      ensureCanMutateNextListeners();
      var index = nextListeners.indexOf(listener);
      nextListeners.splice(index, 1);
      currentListeners = null;
    };
  }
  /**
   * Dispatches an action. It is the only way to trigger a state change.
   *
   * The `reducer` function, used to create the store, will be called with the
   * current state tree and the given `action`. Its return value will
   * be considered the **next** state of the tree, and the change listeners
   * will be notified.
   *
   * The base implementation only supports plain object actions. If you want to
   * dispatch a Promise, an Observable, a thunk, or something else, you need to
   * wrap your store creating function into the corresponding middleware. For
   * example, see the documentation for the `redux-thunk` package. Even the
   * middleware will eventually dispatch plain object actions using this method.
   *
   * @param {Object} action A plain object representing “what changed”. It is
   * a good idea to keep actions serializable so you can record and replay user
   * sessions, or use the time travelling `redux-devtools`. An action must have
   * a `type` property which may not be `undefined`. It is a good idea to use
   * string constants for action types.
   *
   * @returns {Object} For convenience, the same action object you dispatched.
   *
   * Note that, if you use a custom middleware, it may wrap `dispatch()` to
   * return something else (for example, a Promise you can await).
   */


  function dispatch(action) {
    if (!isPlainObject(action)) {
      throw new Error(formatProdErrorMessage(7) );
    }

    if (typeof action.type === 'undefined') {
      throw new Error(formatProdErrorMessage(8) );
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

    var listeners = currentListeners = nextListeners;

    for (var i = 0; i < listeners.length; i++) {
      var listener = listeners[i];
      listener();
    }

    return action;
  }
  /**
   * Replaces the reducer currently used by the store to calculate the state.
   *
   * You might need this if your app implements code splitting and you want to
   * load some of the reducers dynamically. You might also need this if you
   * implement a hot reloading mechanism for Redux.
   *
   * @param {Function} nextReducer The reducer for the store to use instead.
   * @returns {void}
   */


  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== 'function') {
      throw new Error(formatProdErrorMessage(10) );
    }

    currentReducer = nextReducer; // This action has a similiar effect to ActionTypes.INIT.
    // Any reducers that existed in both the new and old rootReducer
    // will receive the previous state. This effectively populates
    // the new state tree with any relevant data from the old one.

    dispatch({
      type: ActionTypes.REPLACE
    });
  }
  /**
   * Interoperability point for observable/reactive libraries.
   * @returns {observable} A minimal observable of state changes.
   * For more information, see the observable proposal:
   * https://github.com/tc39/proposal-observable
   */


  function observable() {
    var _ref;

    var outerSubscribe = subscribe;
    return _ref = {
      /**
       * The minimal observable subscription method.
       * @param {Object} observer Any object that can be used as an observer.
       * The observer object should have a `next` method.
       * @returns {subscription} An object with an `unsubscribe` method that can
       * be used to unsubscribe the observable from the store, and prevent further
       * emission of values from the observable.
       */
      subscribe: function subscribe(observer) {
        if (typeof observer !== 'object' || observer === null) {
          throw new Error(formatProdErrorMessage(11) );
        }

        function observeState() {
          if (observer.next) {
            observer.next(getState());
          }
        }

        observeState();
        var unsubscribe = outerSubscribe(observeState);
        return {
          unsubscribe: unsubscribe
        };
      }
    }, _ref[$$observable] = function () {
      return this;
    }, _ref;
  } // When a store is created, an "INIT" action is dispatched so that every
  // reducer returns their initial state. This effectively populates
  // the initial state tree.


  dispatch({
    type: ActionTypes.INIT
  });
  return _ref2 = {
    dispatch: dispatch,
    subscribe: subscribe,
    getState: getState,
    replaceReducer: replaceReducer
  }, _ref2[$$observable] = observable, _ref2;
}

function assertReducerShape(reducers) {
  Object.keys(reducers).forEach(function (key) {
    var reducer = reducers[key];
    var initialState = reducer(undefined, {
      type: ActionTypes.INIT
    });

    if (typeof initialState === 'undefined') {
      throw new Error(formatProdErrorMessage(12) );
    }

    if (typeof reducer(undefined, {
      type: ActionTypes.PROBE_UNKNOWN_ACTION()
    }) === 'undefined') {
      throw new Error(formatProdErrorMessage(13) );
    }
  });
}
/**
 * Turns an object whose values are different reducer functions, into a single
 * reducer function. It will call every child reducer, and gather their results
 * into a single state object, whose keys correspond to the keys of the passed
 * reducer functions.
 *
 * @param {Object} reducers An object whose values correspond to different
 * reducer functions that need to be combined into one. One handy way to obtain
 * it is to use ES6 `import * as reducers` syntax. The reducers may never return
 * undefined for any action. Instead, they should return their initial state
 * if the state passed to them was undefined, and the current state for any
 * unrecognized action.
 *
 * @returns {Function} A reducer function that invokes every reducer inside the
 * passed object, and builds a state object with the same shape.
 */


function combineReducers(reducers) {
  var reducerKeys = Object.keys(reducers);
  var finalReducers = {};

  for (var i = 0; i < reducerKeys.length; i++) {
    var key = reducerKeys[i];

    if (typeof reducers[key] === 'function') {
      finalReducers[key] = reducers[key];
    }
  }

  var finalReducerKeys = Object.keys(finalReducers); // This is used to make sure we don't warn about the same

  var shapeAssertionError;

  try {
    assertReducerShape(finalReducers);
  } catch (e) {
    shapeAssertionError = e;
  }

  return function combination(state, action) {
    if (state === void 0) {
      state = {};
    }

    if (shapeAssertionError) {
      throw shapeAssertionError;
    }

    var hasChanged = false;
    var nextState = {};

    for (var _i = 0; _i < finalReducerKeys.length; _i++) {
      var _key = finalReducerKeys[_i];
      var reducer = finalReducers[_key];
      var previousStateForKey = state[_key];
      var nextStateForKey = reducer(previousStateForKey, action);

      if (typeof nextStateForKey === 'undefined') {
        action && action.type;
        throw new Error(formatProdErrorMessage(14) );
      }

      nextState[_key] = nextStateForKey;
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey;
    }

    hasChanged = hasChanged || finalReducerKeys.length !== Object.keys(state).length;
    return hasChanged ? nextState : state;
  };
}

/**
 * Composes single-argument functions from right to left. The rightmost
 * function can take multiple arguments as it provides the signature for
 * the resulting composite function.
 *
 * @param {...Function} funcs The functions to compose.
 * @returns {Function} A function obtained by composing the argument functions
 * from right to left. For example, compose(f, g, h) is identical to doing
 * (...args) => f(g(h(...args))).
 */
function compose() {
  for (var _len = arguments.length, funcs = new Array(_len), _key = 0; _key < _len; _key++) {
    funcs[_key] = arguments[_key];
  }

  if (funcs.length === 0) {
    return function (arg) {
      return arg;
    };
  }

  if (funcs.length === 1) {
    return funcs[0];
  }

  return funcs.reduce(function (a, b) {
    return function () {
      return a(b.apply(void 0, arguments));
    };
  });
}

var _=0;function o$1(o,e,n,t,f,l){var s,u,a={};for(u in e)"ref"==u?s=e[u]:a[u]=e[u];var i={type:o,props:a,key:n,ref:s,__k:null,__:null,__b:0,__e:null,__d:void 0,__c:null,__h:null,constructor:void 0,__v:--_,__source:f,__self:l};if("function"==typeof o&&(s=o.defaultProps))for(u in s)void 0===a[u]&&(a[u]=s[u]);return l$7.vnode&&l$7.vnode(i),i}

var t,r,u,i,o=0,f=[],c=[],e=l$7.__b,a=l$7.__r,v=l$7.diffed,l=l$7.__c,m=l$7.unmount;function d(t,u){l$7.__h&&l$7.__h(r,t,o||u),o=0;var i=r.__H||(r.__H={__:[],__h:[]});return t>=i.__.length&&i.__.push({__V:c}),i.__[t]}function p(u,i){var o=d(t++,3);!l$7.__s&&z(o.__H,i)&&(o.__=u,o.i=i,r.__H.__h.push(o));}function b(){for(var t;t=f.shift();)if(t.__P&&t.__H)try{t.__H.__h.forEach(k),t.__H.__h.forEach(w),t.__H.__h=[];}catch(r){t.__H.__h=[],l$7.__e(r,t.__v);}}l$7.__b=function(n){r=null,e&&e(n);},l$7.__r=function(n){a&&a(n),t=0;var i=(r=n.__c).__H;i&&(u===r?(i.__h=[],r.__h=[],i.__.forEach(function(n){n.__N&&(n.__=n.__N),n.__V=c,n.__N=n.i=void 0;})):(i.__h.forEach(k),i.__h.forEach(w),i.__h=[],t=0)),u=r;},l$7.diffed=function(t){v&&v(t);var o=t.__c;o&&o.__H&&(o.__H.__h.length&&(1!==f.push(o)&&i===l$7.requestAnimationFrame||((i=l$7.requestAnimationFrame)||j)(b)),o.__H.__.forEach(function(n){n.i&&(n.__H=n.i),n.__V!==c&&(n.__=n.__V),n.i=void 0,n.__V=c;})),u=r=null;},l$7.__c=function(t,r){r.some(function(t){try{t.__h.forEach(k),t.__h=t.__h.filter(function(n){return !n.__||w(n)});}catch(u){r.some(function(n){n.__h&&(n.__h=[]);}),r=[],l$7.__e(u,t.__v);}}),l&&l(t,r);},l$7.unmount=function(t){m&&m(t);var r,u=t.__c;u&&u.__H&&(u.__H.__.forEach(function(n){try{k(n);}catch(n){r=n;}}),u.__H=void 0,r&&l$7.__e(r,u.__v));};var g="function"==typeof requestAnimationFrame;function j(n){var t,r=function(){clearTimeout(u),g&&cancelAnimationFrame(t),setTimeout(n);},u=setTimeout(r,100);g&&(t=requestAnimationFrame(r));}function k(n){var t=r,u=n.__c;"function"==typeof u&&(n.__c=void 0,u()),r=t;}function w(n){var t=r;n.__c=n.__(),r=t;}function z(n,t){return !n||n.length!==t.length||t.some(function(t,r){return t!==n[r]})}

export { D$2 as D, Provider, combineReducers, compose, createStore, o$1 as o, p, useDispatch, useSelector };
