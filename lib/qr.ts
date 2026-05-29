import crypto from "node:crypto";

/**
 * QR token generation. A real implementation would sign tokens with an
 * HMAC keyed by a vault-managed secret so scans are non-forgeable.
 * Prototype: 16 random hex bytes, base32-styled for readability.
 */
export function generateQrToken(): string {
  const bytes = crypto.randomBytes(10);
  const b32 = bytes
    .toString("base64")
    .replace(/\+/g, "")
    .replace(/\//g, "")
    .replace(/=/g, "")
    .toUpperCase();
  // Group as XXXX-XXXX-XXXX-XX
  return `${b32.slice(0, 4)}-${b32.slice(4, 8)}-${b32.slice(8, 12)}-${b32.slice(12, 14)}`;
}

/**
 * Renders a QR code as an inline SVG string for embedding in admin pages.
 * Uses a minimal lookup-based pattern for the prototype — visually
 * QR-like, not actually scannable. In production we'd use the `qrcode`
 * npm package.
 */
export function renderQrSvg(token: string, size = 160): string {
  // Deterministic pseudo-random grid from the token
  const hash = crypto.createHash("sha256").update(token).digest();
  const grid = 21;
  const cell = size / grid;
  const cells: string[] = [];

  // Corner finders (classic QR look)
  const finder = (x: number, y: number): string => `
    <rect x="${x * cell}" y="${y * cell}" width="${cell * 7}" height="${cell * 7}" fill="black"/>
    <rect x="${(x + 1) * cell}" y="${(y + 1) * cell}" width="${cell * 5}" height="${cell * 5}" fill="white"/>
    <rect x="${(x + 2) * cell}" y="${(y + 2) * cell}" width="${cell * 3}" height="${cell * 3}" fill="black"/>
  `;
  cells.push(finder(0, 0), finder(grid - 7, 0), finder(0, grid - 7));

  // Data area — pseudo-random from hash
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const inFinder =
        (x < 8 && y < 8) ||
        (x >= grid - 8 && y < 8) ||
        (x < 8 && y >= grid - 8);
      if (inFinder) continue;
      const byte = hash[(y * grid + x) % hash.length];
      const bit = (byte >> ((x + y) % 8)) & 1;
      if (bit) {
        cells.push(
          `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="black"/>`,
        );
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="white"/>${cells.join("")}</svg>`;
}
