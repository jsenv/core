import { ancestor } from "acorn-walk";

import { parseJsWithAcorn } from "./parse_js_with_acorn.js";
import {
  analyzeImportExpression,
  analyzeImportDeclaration,
  analyzeExportNamedDeclaration,
  analyzeExportAllDeclaration,
} from "./js_static_analysis/import_export.js";
import {
  isImportMetaResolveCall,
  analyzeImportMetaResolveCall,
} from "./js_static_analysis/import_meta_resolve.js";
import {
  isNewWorkerCall,
  analyzeNewWorkerCall,
  isNewSharedWorkerCall,
  analyzeNewSharedWorkerCall,
  isServiceWorkerRegisterCall,
  analyzeServiceWorkerRegisterCall,
} from "./js_static_analysis/web_worker_entry_point.js";
import {
  isImportScriptsCall,
  analyzeImportScriptCalls,
} from "./js_static_analysis/web_worker.js";
import {
  isNewUrlCall,
  analyzeNewUrlCall,
} from "./js_static_analysis/new_url.js";
import {
  isSystemRegisterCall,
  analyzeSystemRegisterCall,
  isSystemImportCall,
  analyzeSystemImportCall,
  isSystemResolveCall,
  analyzeSystemResolveCall,
} from "./js_static_analysis/system.js";

export const parseJsUrls = async ({
  js,
  url,
  isJsModule = false,
  isWebWorker = false,
} = {}) => {
  const jsUrls = [];
  const jsAst = await parseJsWithAcorn({
    js,
    url,
    isJsModule,
  });
  const onUrl = (jsUrl) => {
    jsUrls.push(jsUrl);
  };
  ancestor(jsAst, {
    ImportDeclaration: (node) => {
      analyzeImportDeclaration(node, { onUrl });
    },
    ImportExpression: (node) => {
      analyzeImportExpression(node, { onUrl });
    },
    ExportNamedDeclaration: (node) => {
      analyzeExportNamedDeclaration(node, { onUrl });
    },
    ExportAllDeclaration: (node) => {
      analyzeExportAllDeclaration(node, { onUrl });
    },
    CallExpression: (node) => {
      if (isJsModule && isImportMetaResolveCall(node)) {
        analyzeImportMetaResolveCall(node, { onUrl });
        return;
      }
      if (isServiceWorkerRegisterCall(node)) {
        analyzeServiceWorkerRegisterCall(node, {
          isJsModule,
          onUrl,
        });
        return;
      }
      if (isWebWorker && isImportScriptsCall(node)) {
        analyzeImportScriptCalls(node, {
          onUrl,
        });
        return;
      }
      if (!isJsModule && isSystemRegisterCall(node)) {
        analyzeSystemRegisterCall(node, {
          onUrl,
        });
        return;
      }
      if (!isJsModule && isSystemImportCall(node)) {
        analyzeSystemImportCall(node, {
          onUrl,
        });
        return;
      }
      if (!isJsModule && isSystemResolveCall(node)) {
        analyzeSystemResolveCall(node, {
          onUrl,
        });
        return;
      }
    },
    NewExpression: (node, ancestors) => {
      if (isNewWorkerCall(node)) {
        analyzeNewWorkerCall(node, {
          isJsModule,
          onUrl,
        });
        return;
      }
      if (isNewSharedWorkerCall(node)) {
        analyzeNewSharedWorkerCall(node, {
          isJsModule,
          onUrl,
        });
        return;
      }
      if (isNewUrlCall(node)) {
        const parent = ancestors[ancestors.length - 2];
        if (
          parent &&
          (isNewWorkerCall(parent) ||
            isNewSharedWorkerCall(parent) ||
            isServiceWorkerRegisterCall(parent))
        ) {
          return;
        }
        analyzeNewUrlCall(node, {
          isJsModule,
          onUrl,
        });
        return;
      }
    },
  });
  return jsUrls;
};
