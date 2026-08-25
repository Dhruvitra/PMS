/** Same URL detection as inside `linkifyHtmlText` (plain text segments). */
const PLAIN_URL_RE = /https?:\/\/[^\s<]+[^<.,:;"')\]\s]/g;

/** Split plain text into alternating text / URL segments for React rendering. */
export function splitPlainTextWithUrls(text: string): { type: 'text' | 'url'; value: string }[] {
  const out: { type: 'text' | 'url'; value: string }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(PLAIN_URL_RE.source, 'g');
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) });
    out.push({ type: 'url', value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  return out;
}

export function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Escape then linkify URLs and @mentions; safe for comment bodies in HTML. */
export function linkifyEscapedPlainText(text: string): string {
  if (!text) return '';
  return linkifyHtmlText(escapeHtml(text), { urlLayout: 'wrap' });
}

const URL_CLASS_WRAP =
  'text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline underline-offset-2 cursor-pointer transition-colors break-all';
const URL_CLASS_SINGLE_LINE =
  'inline-block max-w-full min-w-0 align-bottom overflow-hidden text-ellipsis whitespace-nowrap text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline underline-offset-2 cursor-pointer transition-colors';

export function linkifyHtmlText(html: string, options?: { urlLayout?: 'wrap' | 'single-line' }): string {
  if (!html || typeof window === 'undefined') return html;

  const singleLine = options?.urlLayout === 'single-line';
  const newUrlClass = singleLine ? URL_CLASS_SINGLE_LINE : URL_CLASS_WRAP;

  const div = document.createElement('div');
  div.innerHTML = html;

  // Ensure existing anchors (e.g. created by an editor) get consistent styling/behavior
  // even if they weren't created by our URL regex.
  div.querySelectorAll('a[href]').forEach((a) => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
    // Add link styling if not already present
    const cls = a.getAttribute('class') || '';
    if (!cls.includes('text-indigo-')) {
      a.setAttribute('class', `${cls} ${URL_CLASS_WRAP}`.trim());
    }
    // Prevent nested click handlers from hijacking navigation (task row clicks, etc.)
    if (!a.getAttribute('onclick')) {
      a.setAttribute('onclick', 'event.stopPropagation()');
    }
  });

  const processNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentNode as HTMLElement;
      if (parent && parent.tagName !== 'A' && parent.tagName !== 'PRE' && parent.tagName !== 'CODE') {
        const text = node.textContent || '';
        // Basic URL matching regex
        const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
        const mentionRegex = /(@\w+)/g;

        urlRegex.lastIndex = 0;
        const hasUrl = urlRegex.test(text);
        urlRegex.lastIndex = 0;
        mentionRegex.lastIndex = 0;
        const hasMention = mentionRegex.test(text);
        mentionRegex.lastIndex = 0;

        if (hasUrl || hasMention) {
          let newHtml = text;
          if (hasUrl) {
            newHtml = newHtml.replace(urlRegex, (url) => {
              const titleAttr = singleLine ? ` title="${url.replace(/"/g, '&quot;')}"` : '';
              return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="${newUrlClass}" onclick="event.stopPropagation()"${titleAttr}>${url}</a>`;
            });
          }
          if (hasMention) {
            newHtml = newHtml.replace(mentionRegex, (mention) => {
              return `<span class="text-blue-600 dark:text-blue-400 font-bold cursor-default">${mention}</span>`;
            });
          }
          const span = document.createElement('span');
          span.innerHTML = newHtml;
          parent.replaceChild(span, node);
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName !== 'A' && el.tagName !== 'PRE' && el.tagName !== 'CODE') {
        const children = Array.from(el.childNodes);
        children.forEach(processNode);
      }
    }
  };

  const children = Array.from(div.childNodes);
  children.forEach(processNode);

  // Unwrap the root spans that we created so we don't end up with heavily nested spans over time
  // Wait, replacing node with a span works but it's simpler to just return div.innerHTML
  return div.innerHTML;
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

