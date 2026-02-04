/**
 * Watermarking Service
 * Embeds buyer information into skill files for tracking
 */

const crypto = require('crypto');

/**
 * Generate a unique purchase fingerprint
 */
function generateFingerprint(wallet, skillId, purchaseId) {
  const data = `${wallet}:${skillId}:${purchaseId}:${Date.now()}`;
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

/**
 * Create visible watermark header
 */
function createVisibleWatermark(wallet, skillId, purchaseId, purchaseDate) {
  const fingerprint = generateFingerprint(wallet, skillId, purchaseId);
  
  return `<!--
================================================================================
  SKILLSTORE.MD - Licensed Content
================================================================================
  License ID: ${purchaseId}
  Fingerprint: ${fingerprint}
  Licensed To: ${wallet.slice(0, 8)}...${wallet.slice(-4)}
  Purchase Date: ${purchaseDate}
  
  This content is licensed for personal use only.
  Redistribution is prohibited and traceable.
  
  Verify: https://skillstoremd.xyz/verify/${fingerprint}
================================================================================
-->

`;
}

/**
 * Create invisible watermark (steganographic)
 * Uses zero-width characters to embed data
 */
function createInvisibleWatermark(wallet, purchaseId) {
  // Encode wallet + purchase ID as binary
  const data = `${wallet}:${purchaseId}`;
  const binary = Buffer.from(data).toString('binary');
  
  // Convert to zero-width characters
  // Using: U+200B (zero width space), U+200C (zero width non-joiner)
  let invisible = '';
  for (const char of binary) {
    const bits = char.charCodeAt(0).toString(2).padStart(8, '0');
    for (const bit of bits) {
      invisible += bit === '0' ? '\u200B' : '\u200C';
    }
  }
  
  return invisible;
}

/**
 * Extract invisible watermark
 */
function extractInvisibleWatermark(text) {
  try {
    // Extract zero-width characters
    const zwChars = text.match(/[\u200B\u200C]+/g);
    if (!zwChars) return null;
    
    const invisible = zwChars.join('');
    
    // Convert back to binary
    let binary = '';
    let byte = '';
    for (const char of invisible) {
      byte += char === '\u200B' ? '0' : '1';
      if (byte.length === 8) {
        binary += String.fromCharCode(parseInt(byte, 2));
        byte = '';
      }
    }
    
    // Parse wallet:purchaseId
    const [wallet, purchaseId] = binary.split(':');
    return { wallet, purchaseId };
  } catch (err) {
    return null;
  }
}

/**
 * Watermark a skill file
 */
function watermarkSkill(content, { wallet, skillId, purchaseId, purchaseDate }) {
  // Add visible header
  const header = createVisibleWatermark(wallet, skillId, purchaseId, purchaseDate);
  
  // Add invisible watermark at strategic points
  const invisibleMark = createInvisibleWatermark(wallet, purchaseId);
  
  // Insert invisible marks after headings
  const markedContent = content.replace(
    /^(#{1,6}.*?)$/gm,
    `$1${invisibleMark}`
  );
  
  // Also insert in random paragraph breaks (harder to remove)
  const paragraphs = markedContent.split('\n\n');
  const markedParagraphs = paragraphs.map((p, i) => {
    // Insert invisible mark every ~3 paragraphs
    if (i > 0 && i % 3 === 0 && !p.startsWith('#')) {
      return invisibleMark + p;
    }
    return p;
  });
  
  return header + markedParagraphs.join('\n\n');
}

/**
 * Verify a watermarked file
 */
function verifyWatermark(content) {
  // Try to extract visible watermark
  const headerMatch = content.match(/Fingerprint: ([a-f0-9]+)/);
  const licenseMatch = content.match(/License ID: ([a-zA-Z0-9-]+)/);
  const walletMatch = content.match(/Licensed To: ([a-zA-Z0-9.]+)/);
  
  // Try to extract invisible watermark
  const invisible = extractInvisibleWatermark(content);
  
  return {
    hasVisibleWatermark: !!(headerMatch && licenseMatch),
    fingerprint: headerMatch?.[1] || null,
    licenseId: licenseMatch?.[1] || null,
    walletHint: walletMatch?.[1] || null,
    hasInvisibleWatermark: !!invisible,
    invisibleData: invisible,
  };
}

/**
 * Strip watermarks (for comparison/detection)
 * Returns content with watermarks removed
 */
function stripWatermarks(content) {
  // Remove visible header
  let stripped = content.replace(
    /<!--[\s\S]*?SKILLSTORE\.MD[\s\S]*?-->\n*/,
    ''
  );
  
  // Remove zero-width characters
  stripped = stripped.replace(/[\u200B\u200C]/g, '');
  
  return stripped.trim();
}

/**
 * Compare two files to detect piracy
 * Returns similarity score
 */
function detectPiracy(originalContent, suspectContent) {
  // Strip watermarks for fair comparison
  const original = stripWatermarks(originalContent);
  const suspect = stripWatermarks(suspectContent);
  
  // Simple word-level comparison
  const originalWords = new Set(original.toLowerCase().match(/\w+/g) || []);
  const suspectWords = new Set(suspect.toLowerCase().match(/\w+/g) || []);
  
  const intersection = [...originalWords].filter(w => suspectWords.has(w));
  const union = new Set([...originalWords, ...suspectWords]);
  
  const similarity = intersection.length / union.size;
  
  // Check for watermark presence
  const watermarkInfo = verifyWatermark(suspectContent);
  
  return {
    similarity: Math.round(similarity * 100),
    isProbablyCopied: similarity > 0.8,
    hasWatermark: watermarkInfo.hasVisibleWatermark || watermarkInfo.hasInvisibleWatermark,
    watermarkInfo,
  };
}

module.exports = {
  watermarkSkill,
  verifyWatermark,
  stripWatermarks,
  detectPiracy,
  generateFingerprint,
};

