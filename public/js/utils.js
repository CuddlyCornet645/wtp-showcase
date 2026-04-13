// ═══════════════════════════════════════════════════════════════════════
// UTILS: Utility functions shared across modules
// ═══════════════════════════════════════════════════════════════════════

// Escape HTML special characters
export function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Extract code parameter from WTP share URL
export function extractCodeParam(url) {
  if (!url) return null;

  // Case 1: Query string: ?code=XXX
  const queryMatch = url.match(/[?&]code=([^&]+)/);
  if (queryMatch && queryMatch[1]) {
    return queryMatch[1];
  }

  // Case 2: Hash with embedded query: #?code=XXX or #code=XXX
  if (url.includes('#')) {
    const hashPart = url.split('#')[1];
    const hashMatch = hashPart.match(/[?&]?code=([^&]+)/);
    if (hashMatch && hashMatch[1]) {
      return hashMatch[1];
    }
  }

  return null;
}

// Decode WTP code from URL (Base64url → decompress → JSON)
export function decodeWTPCode(url) {
  try {
    if (!url) return null;

    const codeParam = extractCodeParam(url);
    if (!codeParam) return null;

    // Convert Base64url to Standard Base64 (replace - with + and _ with /)
    const base64Standard = codeParam.replace(/-/g, '+').replace(/_/g, '/');
    const decomp = LZString.decompressFromBase64(base64Standard);

    return decomp ? JSON.parse(decomp) : null;
  } catch (e) {
    console.error('Code decode error:', e);
    return null;
  }
}
