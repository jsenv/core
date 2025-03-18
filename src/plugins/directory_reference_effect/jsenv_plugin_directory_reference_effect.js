import { URL_META } from "@jsenv/url-meta";
import { urlToFilename } from "@jsenv/urls";
import { defineNonEnumerableProperties } from "../../kitchen/errors.js";

export const jsenvPluginDirectoryReferenceEffect = (
  directoryReferenceEffect = "error",
  { rootDirectoryUrl },
) => {
  let getDirectoryReferenceEffect;
  if (typeof directoryReferenceEffect === "string") {
    getDirectoryReferenceEffect = () => directoryReferenceEffect;
  } else if (typeof directoryReferenceEffect === "function") {
    getDirectoryReferenceEffect = directoryReferenceEffect;
  } else if (typeof directoryReferenceEffect === "object") {
    const associations = URL_META.resolveAssociations(
      { effect: directoryReferenceEffect },
      rootDirectoryUrl,
    );
    getDirectoryReferenceEffect = (reference) => {
      const { url } = reference;
      const meta = URL_META.applyAssociations({ url, associations });
      return meta.effect || "error";
    };
  }

  return {
    name: "jsenv:directory_reference_effect",
    appliesDuring: "*",
    redirectReference: (reference) => {
      // http, https, data, about, ...
      if (!reference.url.startsWith("file:")) {
        return null;
      }
      if (reference.isInline) {
        return null;
      }
      if (reference.ownerUrlInfo.type === "directory") {
        reference.dirnameHint = reference.ownerUrlInfo.filenameHint;
      }
      const { pathname } = new URL(reference.url);
      if (pathname[pathname.length - 1] !== "/") {
        return null;
      }
      reference.expectedType = "directory";
      if (reference.ownerUrlInfo.type === "directory") {
        reference.dirnameHint = reference.ownerUrlInfo.filenameHint;
      }
      if (reference.type === "filesystem") {
        reference.filenameHint = `${
          reference.ownerUrlInfo.filenameHint
        }${urlToFilename(reference.url)}/`;
      } else if (reference.specifierPathname.endsWith("./")) {
      } else {
        reference.filenameHint = `${urlToFilename(reference.url)}/`;
      }
      let actionForDirectory;
      if (reference.type === "a_href") {
        actionForDirectory = "copy";
      } else if (reference.type === "filesystem") {
        actionForDirectory = "copy";
      } else if (reference.type === "http_request") {
        actionForDirectory = "preserve";
      } else {
        actionForDirectory = getDirectoryReferenceEffect(reference);
      }
      reference.actionForDirectory = actionForDirectory;
      if (actionForDirectory !== "copy") {
        reference.isWeak = true;
      }
      if (actionForDirectory === "error") {
        const error = new Error("Reference leads to a directory");
        defineNonEnumerableProperties(error, {
          isJsenvCookingError: true,
          code: "DIRECTORY_REFERENCE_NOT_ALLOWED",
        });
        throw error;
      }
      if (actionForDirectory === "preserve") {
        return reference.ownerUrlInfo.context.dev
          ? null
          : `ignore:${reference.specifier}`;
      }
      return null;
    },
  };
};
