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
import {
  isNewBlobCall,
  analyzeNewBlobCall,
} from "./js_static_analysis/new_blob.js";
import {
  isNewInlineContentCall,
  analyzeNewInlineContentCall,
} from "./js_static_analysis/new_inline_content.js";
import {
  isJSONParseCall,
  analyzeJSONParseCall,
} from "./js_static_analysis/json_parse.js";

export const parseJsUrls = ({
  js,
  url,
  ast,
  isJsModule = false,
  isWebWorker = false,
  inlineContent = true,
} = {}) => {
  const jsUrls = [];
  if (ast === undefined) {
    ast = parseJsWithAcorn({
      js,
      url,
      isJsModule,
    });
  }
  const onUrl = (jsUrl) => {
    jsUrls.push(jsUrl);
  };
  const onInlineContent = (inlineContentInfo) => {
    jsUrls.push({
      isInline: true,
      ...inlineContentInfo,
    });
  };
  ancestor(ast, {
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
      if (inlineContent && isJSONParseCall(node)) {
        analyzeJSONParseCall(node, {
          onInlineContent,
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
      if (inlineContent && isNewInlineContentCall(node)) {
        analyzeNewInlineContentCall(node, {
          onInlineContent,
        });
        return;
      }
      if (inlineContent && isNewBlobCall(node)) {
        analyzeNewBlobCall(node, {
          onInlineContent,
        });
        return;
      }
    },
  });
  return jsUrls;
};
