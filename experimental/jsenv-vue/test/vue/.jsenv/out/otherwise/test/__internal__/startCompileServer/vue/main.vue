System.register([], function (_export, _context) {
  "use strict";

  var app, __vue_render__, __vue_staticRenderFns__, __vue_inject_styles__, __vue_scope_id__, __vue_module_identifier__, __vue_is_functional_template__, __vue_component__;
  /* component normalizer */


  function __vue_normalize__(template, style, script, scope, functional, moduleIdentifier, shadowMode, createInjector, createInjectorSSR, createInjectorShadow) {
    var component = (typeof script === 'function' ? script.options : script) || {}; // For security concerns, we use only base name in production mode.

    component.__file = "file:///Users/d.maillard/Dev/Github/jsenv-core/test/__internal__/startCompileServer/vue/main.vue";

    if (!component.render) {
      component.render = template.render;
      component.staticRenderFns = template.staticRenderFns;
      component._compiled = true;
      if (functional) component.functional = true;
    }

    component._scopeId = scope;

    if (true) {
      var hook;

      if (undefined) {
        // In SSR.
        hook = function hook(context) {
          // 2.3 injection
          context = context || this.$vnode && this.$vnode.ssrContext || this.parent && this.parent.$vnode && this.parent.$vnode.ssrContext; // functional
          // 2.2 with runInNewContext: true

          if (!context && typeof __VUE_SSR_CONTEXT__ !== 'undefined') {
            context = __VUE_SSR_CONTEXT__;
          } // inject component styles


          if (style) {
            style.call(this, createInjectorSSR(context));
          } // register component module identifier for async chunk inference


          if (context && context._registeredComponents) {
            context._registeredComponents.add(moduleIdentifier);
          }
        }; // used by ssr in case component is cached and beforeCreate
        // never gets called


        component._ssrRegister = hook;
      } else if (style) {
        hook = shadowMode ? function (context) {
          style.call(this, createInjectorShadow(context, this.$root.$options.shadowRoot));
        } : function (context) {
          style.call(this, createInjector(context));
        };
      }

      if (hook !== undefined) {
        if (component.functional) {
          // register for functional component in vue file
          var originalRender = component.render;

          component.render = function renderWithStyleInjection(h, context) {
            hook.call(context);
            return originalRender(h, context);
          };
        } else {
          // inject component registration as beforeCreate hook
          var existing = component.beforeCreate;
          component.beforeCreate = existing ? [].concat(existing, hook) : [hook];
        }
      }
    }

    return component;
  }
  /* style inject */


  function __vue_create_injector__() {
    var styles = __vue_create_injector__.styles || (__vue_create_injector__.styles = {});
    var isOldIE = typeof navigator !== 'undefined' && /msie [6-9]\\b/.test(navigator.userAgent.toLowerCase());
    return function addStyle(id, css) {
      if (document.querySelector('style[data-vue-ssr-id~="' + id + '"]')) return; // SSR styles are present.

      var group = isOldIE ? css.media || 'default' : id;
      var style = styles[group] || (styles[group] = {
        ids: [],
        parts: [],
        element: undefined
      });

      if (!style.ids.includes(id)) {
        var code = css.source;
        var index = style.ids.length;
        style.ids.push(id);

        if (undefined && css.map) {
          // https://developer.chrome.com/devtools/docs/javascript-debugging
          // this makes source maps inside style tags work properly in Chrome
          code += '\n/*# sourceURL=' + css.map.sources[0] + ' */'; // http://stackoverflow.com/a/26603875

          code += '\n/*# sourceMappingURL=data:application/json;base64,' + btoa(unescape(encodeURIComponent(JSON.stringify(css.map)))) + ' */';
        }

        if (isOldIE) {
          style.element = style.element || document.querySelector('style[data-group=' + group + ']');
        }

        if (!style.element) {
          var head = document.head || document.getElementsByTagName('head')[0];
          var el = style.element = document.createElement('style');
          el.type = 'text/css';
          if (css.media) el.setAttribute('media', css.media);

          if (isOldIE) {
            el.setAttribute('data-group', group);
            el.setAttribute('data-next-index', '0');
          }

          head.appendChild(el);
        }

        if (isOldIE) {
          index = parseInt(style.element.getAttribute('data-next-index'));
          style.element.setAttribute('data-next-index', index + 1);
        }

        if (style.element.styleSheet) {
          style.parts.push(code);
          style.element.styleSheet.cssText = style.parts.filter(Boolean).join('\n');
        } else {
          var textNode = document.createTextNode(code);
          var nodes = style.element.childNodes;
          if (nodes[index]) style.element.removeChild(nodes[index]);
          if (nodes.length) style.element.insertBefore(textNode, nodes[index]);else style.element.appendChild(textNode);
        }
      }
    };
  }
  /* style inject SSR */

  /* style inject shadow dom */


  return {
    setters: [],
    execute: function () {
      /* script */
      //
      //
      //
      //
      //
      //
      //
      //
      //
      //
      //
      //
      app = new Vue({
        el: "#app",
        data: {
          message: "Hello Vue!"
        }
      });
      /* template */

      __vue_render__ = function __vue_render__() {
        var _vm = this;

        var _h = _vm.$createElement;

        var _c = _vm._self._c || _h;

        return _c("div", {
          attrs: {
            id: "app"
          }
        }, [_vm._v("\n  " + _vm._s(_vm.message) + "\n")]);
      };

      __vue_staticRenderFns__ = [];
      __vue_render__._withStripped = true;
      /* style */

      __vue_inject_styles__ = function __vue_inject_styles__(inject) {
        if (!inject) return;
        inject("data-v-56a597e3_0", {
          source: "\n#app {\n  background: violet;\n}\n",
          map: {
            "version": 3,
            "sources": ["file:///Users/d.maillard/Dev/Github/jsenv-core/test/__internal__/startCompileServer/vue/main.vue"],
            "names": [],
            "mappings": ";AAOA;EACA,kBAAA;AACA",
            "file": "file:///Users/d.maillard/Dev/Github/jsenv-core/test/__internal__/startCompileServer/vue/main.vue",
            "sourcesContent": ["<template>\n  <div id=\"app\">\n    {{ message }}\n  </div>\n</template>\n\n<style>\n#app {\n  background: violet;\n}\n</style>\n\n<script>\nvar app = new Vue({\n  el: \"#app\",\n  data: {\n    message: \"Hello Vue!\",\n  },\n})\n</script>\n"]
          },
          media: undefined
        });
      };
      /* scoped */


      __vue_scope_id__ = undefined;
      /* module identifier */

      __vue_module_identifier__ = undefined;
      /* functional template */

      __vue_is_functional_template__ = false;
      __vue_component__ = /*#__PURE__*/__vue_normalize__({
        render: __vue_render__,
        staticRenderFns: __vue_staticRenderFns__
      }, __vue_inject_styles__, {}, __vue_scope_id__, __vue_is_functional_template__, __vue_module_identifier__, false, __vue_create_injector__, undefined, undefined);

      _export("default", __vue_component__);
    }
  };
});
//# sourceMappingURL=main.vue.map