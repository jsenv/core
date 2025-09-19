import { ancestor } from "acorn-walk";

import {
  analyzeExportAllDeclaration,
  analyzeExportNamedDeclaration,
  analyzeImportDeclaration,
  analyzeImportExpression,
} from "./js_static_analysis/import_export.js";
import {
  analyzeImportMetaResolveCall,
  isImportMetaResolveCall,
} from "./js_static_analysis/import_meta_resolve.js";
import {
  analyzeJSONParseCall,
  isJSONParseCall,
} from "./js_static_analysis/json_parse.js";
import {
  analyzeNewBlobCall,
  isNewBlobCall,
} from "./js_static_analysis/new_blob.js";
import {
  analyzeNewInlineContentCall,
  isNewInlineContentCall,
} from "./js_static_analysis/new_inline_content.js";
import {
  analyzeNewUrlCall,
  isNewUrlCall,
} from "./js_static_analysis/new_url.js";
import {
  analyzeSystemImportCall,
  analyzeSystemRegisterCall,
  analyzeSystemResolveCall,
  isSystemImportCall,
  isSystemRegisterCall,
  isSystemResolveCall,
} from "./js_static_analysis/system.js";
import {
  analyzeImportScriptCalls,
  isImportScriptsCall,
} from "./js_static_analysis/web_worker.js";
import {
  analyzeNewSharedWorkerCall,
  analyzeNewWorkerCall,
  analyzeServiceWorkerRegisterCall,
  isNewSharedWorkerCall,
  isNewWorkerCall,
  isServiceWorkerRegisterCall,
} from "./js_static_analysis/web_worker_entry_point.js";
import { parseJsWithAcorn } from "./parse_js_with_acorn.js";

export const parseJsUrls = ({
  js,
  url,
  ast,
  isJsModule = false,
  isWebWorker = false,
  inlineContent = true,
  isNodeJs = false,
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

  const getCommentBeforeClosingParenthesis = (
    // either new InlineContent() or JSON.parse() for instance
    callNode,
  ) => {
    const args = callNode.arguments;
    let commentMustStartAfter;
    let commentMustEndBefore;
    if (args.length === 0) {
      commentMustStartAfter = callNode.start;
      commentMustEndBefore = callNode.end - 1;
    } else {
      const lastArg = args[args.length - 1];
      commentMustStartAfter = lastArg.start;
      commentMustEndBefore = callNode.end - 1;
    }
    for (const comment of ast.comments) {
      if (
        comment.start > commentMustStartAfter &&
        comment.end < commentMustEndBefore
      ) {
        return comment;
      }
    }
    return null;
  };

  const readInlinedFromUrl = (node) => {
    let inlinedFromUrl;
    const commentBeforeClosingParenthesis =
      getCommentBeforeClosingParenthesis(node);
    if (commentBeforeClosingParenthesis) {
      const text = commentBeforeClosingParenthesis.text;
      const inlinedFromUrlIndex = text.indexOf("inlinedFromUrl=");
      if (inlinedFromUrlIndex > -1) {
        inlinedFromUrl = text.slice(
          inlinedFromUrlIndex + "inlinedFromUrl=".length,
        );
      }
    }
    return inlinedFromUrl;
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
      if (!isNodeJs && isServiceWorkerRegisterCall(node)) {
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
          readInlinedFromUrl,
        });
        return;
      }
    },
    NewExpression: (node, ancestors) => {
      if (isNewWorkerCall(node)) {
        analyzeNewWorkerCall(node, {
          isJsModule,
          // isNodeJs,
          onUrl,
        });
        return;
      }
      if (!isNodeJs && isNewSharedWorkerCall(node)) {
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
          readInlinedFromUrl,
        });
        return;
      }
      if (inlineContent && isNewBlobCall(node)) {
        analyzeNewBlobCall(node, {
          onInlineContent,
          readInlinedFromUrl,
        });
        return;
      }
    },
  });
  return jsUrls;
};
