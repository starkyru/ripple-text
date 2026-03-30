import type { LetterInput } from "../core/types";

/**
 * Walk the DOM under `root`, extract every visible character with its
 * screen position and computed font using Range.getBoundingClientRect().
 */
export function extractTextFromDOM(
  root: HTMLElement,
  maxChars = 4000,
): LetterInput[] {
  const letters: LetterInput[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();

  let node: Node | null = walker.nextNode();
  while (node && letters.length < maxChars) {
    const text = node.textContent ?? "";
    if (!text.trim()) {
      node = walker.nextNode();
      continue;
    }

    const parent = node.parentElement;
    if (!parent) {
      node = walker.nextNode();
      continue;
    }

    const style = getComputedStyle(parent);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      node = walker.nextNode();
      continue;
    }

    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

    for (let i = 0; i < text.length && letters.length < maxChars; i++) {
      const ch = text[i];
      if (/\s/.test(ch)) continue;

      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      letters.push({
        char: ch,
        x: rect.left,
        y: rect.top + rect.height * 0.75,
        font,
      });
    }

    node = walker.nextNode();
  }

  range.detach();
  return letters;
}

/**
 * Create letter inputs from a plain text string, laid out on a canvas context.
 */
export function layoutText(
  ctx: CanvasRenderingContext2D,
  text: string,
  options: {
    font?: string;
    fontSize?: number;
    margin?: number;
    maxWidth?: number;
    maxHeight?: number;
    lineHeight?: number;
  } = {},
): LetterInput[] {
  const fontSize = options.fontSize ?? 16;
  const font = options.font ?? `${fontSize}px "Courier New", monospace`;
  const margin = options.margin ?? 40;
  const maxWidth = (options.maxWidth ?? ctx.canvas.width) - margin * 2;
  const maxHeight = options.maxHeight ?? ctx.canvas.height;
  const lineHeight = options.lineHeight ?? fontSize * 1.6;

  ctx.font = font;
  const letters: LetterInput[] = [];
  let x = margin;
  let y = margin + fontSize;
  const words = text.split(" ");

  for (const word of words) {
    const wordWidth = ctx.measureText(word + " ").width;
    if (x + wordWidth > margin + maxWidth && x > margin) {
      x = margin;
      y += lineHeight;
    }
    if (y > maxHeight - margin) break;

    for (const char of word) {
      const charWidth = ctx.measureText(char).width;
      letters.push({ char, x, y, font });
      x += charWidth;
    }
    x += ctx.measureText(" ").width;
  }

  return letters;
}
