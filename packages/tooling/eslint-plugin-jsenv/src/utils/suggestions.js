// Helper function to find similar parameter names (for typo suggestions)
export function findSimilarParams(unknownParam, availableParams) {
  const suggestions = [];
  const unknownLower = unknownParam.toLowerCase();

  for (const param of availableParams) {
    const paramLower = param.toLowerCase();

    // Exact case-insensitive match
    if (unknownLower === paramLower && unknownParam !== param) {
      suggestions.unshift(param); // Put at front
      continue;
    }

    // Starting with same letters
    if (param.startsWith(unknownParam.charAt(0)) && param !== unknownParam) {
      const similarity = calculateSimilarity(unknownParam, param);
      if (similarity > 0.6) {
        suggestions.push(param);
      }
    }
  }

  return suggestions.slice(0, 3); // Max 3 suggestions
}

// Simple similarity calculation (Levenshtein-like)
export function calculateSimilarity(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

export function levenshteinDistance(str1, str2) {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}
