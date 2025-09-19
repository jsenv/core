import { statSync } from "fs";

/**
 * Cache object structure similar to eslint-plugin-import-x
 */
class CacheObject {
  constructor(result, lastSeen) {
    this.result = result;
    this.lastSeen = lastSeen;
  }
}

/**
 * File parsing cache with mtime-based invalidation
 * Based on eslint-plugin-import-x's export-map caching mechanism
 */
class FileParseCache {
  constructor() {
    this.cache = new Map();
    this.defaultLifetime = 30; // 30 seconds default cache lifetime
  }

  /**
   * Create cache key from file path and context
   * @param {string} filePath - File path
   * @param {Object} context - ESLint context
   * @returns {string} - Cache key
   */
  createCacheKey(filePath, context) {
    // Create a stable hash based on parser options and settings
    const parserOptions =
      context.languageOptions?.parserOptions || context.parserOptions || {};
    const parserPath = context.languageOptions?.parser || "espree";
    const settings = context.settings || {};

    // Simple hash based on key properties
    const hash = JSON.stringify({
      ecmaVersion: parserOptions.ecmaVersion,
      sourceType: parserOptions.sourceType,
      parser: typeof parserPath === "string" ? parserPath : "custom",
      importResolver:
        settings["import-x/resolver"] || settings["import/resolver"],
    });

    return `${filePath}\0${hash}`;
  }

  /**
   * Get cached parsed result if still valid
   * @param {string} filePath - File path
   * @param {Object} context - ESLint context
   * @returns {Object|null} - Cached AST or null if not cached/invalid
   */
  get(filePath, context) {
    const cacheKey = this.createCacheKey(filePath, context);
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      return null;
    }

    try {
      // Check if file has been modified since cache entry
      const stats = statSync(filePath);
      const fileMtime = stats.mtime.valueOf();

      if (cached.result && cached.result.mtime === fileMtime) {
        // Check cache age (similar to eslint-plugin-import-x)
        const ageInSeconds = process.hrtime(cached.lastSeen)[0];
        if (ageInSeconds < this.defaultLifetime) {
          return cached.result.ast;
        }
      }
    } catch {
      // File doesn't exist anymore, remove from cache
      this.cache.delete(cacheKey);
    }

    return null;
  }

  /**
   * Set cached parsed result
   * @param {string} filePath - File path
   * @param {Object} context - ESLint context
   * @param {Object} ast - Parsed AST
   */
  set(filePath, context, ast) {
    const cacheKey = this.createCacheKey(filePath, context);

    try {
      const stats = statSync(filePath);
      const cacheEntry = new CacheObject(
        {
          ast,
          mtime: stats.mtime.valueOf(),
        },
        process.hrtime(),
      );

      this.cache.set(cacheKey, cacheEntry);
    } catch {
      // If we can't stat the file, don't cache it
    }
  }

  /**
   * Clear the entire cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Remove expired entries from cache
   */
  cleanup() {
    for (const [key, cached] of this.cache.entries()) {
      const ageInSeconds = process.hrtime(cached.lastSeen)[0];
      if (ageInSeconds >= this.defaultLifetime) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instance (similar to eslint-plugin-import-x's exportCache)
const fileParseCache = new FileParseCache();

export { fileParseCache };
