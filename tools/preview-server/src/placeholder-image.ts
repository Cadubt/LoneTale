/**
 * Imagens de exemplo geradas na hora.
 *
 * A aventura demonstrativa referencia arquivos `.webp` que ainda nao existem.
 * Em vez de deixar buracos na interface durante a pre-visualizacao, geramos um
 * SVG com a cor derivada do nome do asset e o texto alternativo escrito por
 * cima -- e a marca "imagem de exemplo", para que ninguem confunda isto com
 * arte final.
 */

const PALETTES: Array<[string, string]> = [
  ['#2b251b', '#5f4f38'],
  ['#1d2b1f', '#3a6f49'],
  ['#2b1d1d', '#7b241c'],
  ['#1d2130', '#3a55a8'],
  ['#2b2419', '#b05916'],
  ['#241d2b', '#6f4fa8'],
];

function hash(value: string): number {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) {
    total = (total * 31 + value.charCodeAt(index)) >>> 0;
  }
  return total;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Quebra o texto em linhas curtas o suficiente para caber na largura. */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) {
        break;
      }
    } else {
      current = candidate;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines;
}

export function placeholderSvg(assetName: string, alt: string, width = 1280, height = 720): string {
  const palette = PALETTES[hash(assetName) % PALETTES.length] as [string, string];
  const [dark, accent] = palette;
  const lines = wrap(alt || assetName, 38, 3);
  const startY = height / 2 - (lines.length - 1) * 34;

  const text = lines
    .map(
      (line, index) =>
        `<text x="50%" y="${startY + index * 68}" text-anchor="middle" font-family="Georgia, serif" font-size="46" fill="#e8e1d2" opacity="0.92">${escapeXml(line)}</text>`,
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(alt)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${dark}"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.45"/>
    </radialGradient>
    <pattern id="grain" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="none"/>
      <circle cx="1" cy="1" r="0.6" fill="#ffffff" opacity="0.05"/>
      <circle cx="4" cy="3" r="0.5" fill="#000000" opacity="0.06"/>
    </pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>
  <rect width="${width}" height="${height}" fill="url(#grain)"/>
  ${text}
  <text x="50%" y="${height - 48}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="24" letter-spacing="4" fill="#f0d2b8" opacity="0.6">IMAGEM DE EXEMPLO</text>
</svg>`;
}
