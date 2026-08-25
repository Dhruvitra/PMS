import { useState, useRef, useEffect } from 'react';
import api from '../../services/api';

/**
 * TaskDescriptionEditor - Final Premium Edition
 * A professional, high-fidelity workspace editor matching the Notion/ClickUp standard.
 * 
 * Features:
 * - Real-time WYSIWYG editing with high-spec typography (H1-H4, Banners, Toggles).
 * - Dual-icon margin interaction ( + and :: handles ).
 * - Categorial Slash Menu ( TEXT / INLINE ).
 * - Contextual Block Options Menu.
 * - Selection-based Floating Formatting Toolbar.
 * - Reliable Markdown shorthands & image uploads.
 * - Optimized state sync to prevent cursor jumps.
 */

interface Props {
  initialValue: string;
  onSave: (html: string) => void;
  onCancel: () => void;
  taskId: string;
  workspaceName?: string;
}

export function TaskDescriptionEditor({ initialValue, onSave, onCancel, taskId, workspaceName }: Props) {
  // --- STATE ---
  const [html, setHtml] = useState(initialValue || '');
  const [isEmpty, setIsEmpty] = useState(!initialValue || initialValue === '<p><br></p>');
  const [isUploading, setIsUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Floating Menu States
  const [slashMenu, setSlashMenu] = useState({ open: false, top: 0, left: 0 });
  const [selectionMenu, setSelectionMenu] = useState({ open: false, top: 0, left: 0 });
  const [blockMenu, setBlockMenu] = useState({ open: false, top: 0, left: 0 });
  const [colorPicker, setColorPicker] = useState<{ open: boolean; top: number; left: number }>({ open: false, top: 0, left: 0 });
  const [interactionGutter, setInteractionGutter] = useState<{ show: boolean, top: number, targetNode: HTMLElement | null }>({ show: false, top: 0, targetNode: null });
  const [linkHover, setLinkHover] = useState<{ open: boolean; top: number; left: number; href: string; el: HTMLAnchorElement | null }>({ open: false, top: 0, left: 0, href: '', el: null });
  const [floatingHeadingDropdown, setFloatingHeadingDropdown] = useState(false);

  // Refs
  const editorRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastSavedRef = useRef<string>(initialValue || '');
  const htmlRef = useRef<string>(initialValue || '');
  const blurTimerRef = useRef<number | null>(null);
  const savedTimerRef = useRef<number | null>(null);
  const savedRangeRef = useRef<Range | null>(null);

  // Keep htmlRef in sync for use inside event handlers
  useEffect(() => { htmlRef.current = html; }, [html]);

  // Update lastSaved baseline when parent provides a new initialValue
  useEffect(() => { lastSavedRef.current = initialValue || ''; }, [initialValue]);

  // --- INITIALIZATION ---
  useEffect(() => {
    if (editorRef.current) {
        // Force the initial content on mount
        editorRef.current.innerHTML = initialValue || '';
        setIsEmpty(!initialValue || initialValue === '<p><br></p>');
        setHtml(initialValue || '');
        
        // Then focus
        editorRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // Only update innerHTML from external changes if we are not actively typing
    if (editorRef.current && initialValue !== editorRef.current.innerHTML && document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = initialValue || '';
      setIsEmpty(!initialValue || initialValue === '<p><br></p>');
      setHtml(initialValue || '');
    }
  }, [initialValue]);

  // --- INTERACTION HANDLERS ---
  const updateState = () => {
    if (!editorRef.current) return;
    const currentHtml = editorRef.current.innerHTML;
    const currentText = editorRef.current.innerText.trim();
    setHtml(currentHtml);
    setIsEmpty(!currentText && !currentHtml.includes('<img'));
  };

  const handleInput = (e: any) => {
    updateState();
    detectFloatingMenus();
  };

  const detectFloatingMenus = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const container = range.startContainer;
    const text = container.textContent || '';
    const editorRect = editorRef.current!.getBoundingClientRect();

    // 1. Slash Menu Detect
    if (range.startOffset > 0 && text[range.startOffset - 1] === '/') {
        setSlashMenu({ 
            open: true, 
            top: rect.bottom + window.scrollY + 10, 
            left: rect.left + window.scrollX
        });
        setSelectionMenu(prev => ({ ...prev, open: false }));
        setBlockMenu(prev => ({ ...prev, open: false }));
    } else {
        setSlashMenu(prev => ({ ...prev, open: false }));
    }

    // 2. Interaction Gutter ( + and :: )
    const isAtStart = range.startOffset === 0;
    const isEmptyLine = text.trim() === '' || text === '/';
    if (isAtStart || isEmptyLine) {
        const rects = range.getClientRects();
        const top = (rects.length > 0 ? rects[0].top : rect.top) - editorRect.top;
        const container = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer as HTMLElement;
        const targetNode = container?.closest('p, h1, h2, h3, h4, blockquote, div, details, pre') as HTMLElement;
        setInteractionGutter({ show: true, top, targetNode });
    } else {
        setInteractionGutter(prev => ({ ...prev, show: false }));
    }
  };

  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionMenu({
            open: true,
            top: rect.top + window.scrollY - 60,
            left: rect.left + window.scrollX + (rect.width / 2) - 150
        });
        setSlashMenu(prev => ({ ...prev, open: false }));
        setBlockMenu(prev => ({ ...prev, open: false }));
    } else {
        setSelectionMenu(prev => ({ ...prev, open: false }));
        setColorPicker(prev => ({ ...prev, open: false }));
        setFloatingHeadingDropdown(false);
    }
    detectFloatingMenus();
  };

  // --- AUTOSAVE on blur (when focus leaves the editor wrapper) ---
  const performAutoSave = () => {
    const current = htmlRef.current;
    if (current === lastSavedRef.current) return;
    try {
      setSaveStatus('saving');
      onSave(current);
      lastSavedRef.current = current;
      setSaveStatus('saved');
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setSaveStatus('idle'), 1800);
    } catch (err) {
      console.error('Autosave failed:', err);
      setSaveStatus('error');
    }
  };

  // Close editor when clicking outside (save first).
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target || !wrapperRef.current) return;
      if (wrapperRef.current.contains(target)) return;
      // Clicked outside: save and close
      try {
        performAutoSave();
      } finally {
        onCancel();
      }
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditorBlur = () => {
    // Delay so that focus moves to the next element (e.g. a toolbar button) first
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    blurTimerRef.current = window.setTimeout(() => {
      const active = document.activeElement as Node | null;
      // If focus is still inside the editor wrapper (toolbar / menu), don't save yet
      if (active && wrapperRef.current && wrapperRef.current.contains(active)) return;
      performAutoSave();
    }, 150);
  };

  // --- LINK HANDLING ---
  // Matches: https://..., http://..., www.example.com, or bare domain like example.com / sub.example.co.uk (optionally with path)
  const URL_REGEX = /^(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|io|co|dev|app|ai|in|us|uk|gov|edu|info|biz|me|xyz|tech|store|site|online|cloud|so|sh|to|tv|cc|de|fr|jp|ca|au|br|ru|cn|it|es|nl|se|no|fi|pl|ch|be|at|dk|ie|nz|sg|mx|tr|kr)(?:\/[^\s<>"']*)?)$/i;
  const normalizeUrl = (raw: string) => {
    const trimmed = raw.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return 'https://' + trimmed.replace(/^\/+/, '');
  };

  // .editor-surface has no font/size/color CSS of its own -- it relies entirely on inherited
  // styling to match the app's theme (including dark mode). An inline style attribute always
  // wins over inheritance, so keeping pasted elements' styles verbatim (as this used to) let
  // Google Docs/Word/website source formatting -- its own font-family, font-size, and especially
  // color/background -- override the editor's look, which is exactly what read as "copy-paste
  // sometimes doesn't look proper" (worst case: source text colored near-black landing invisible
  // against a dark-mode background). Only bold/italic/underline/strikethrough are worth carrying
  // over from the clipboard; everything else should fall back to the editor's own styling, same
  // as ClickUp/Notion normalize pastes.
  const ALLOWED_PASTE_STYLE_PROPS = new Set(['font-weight', 'font-style', 'text-decoration', 'text-decoration-line']);
  const sanitizePasteStyleAttr = (value: string): string =>
    value.split(';')
      .map(decl => {
        const idx = decl.indexOf(':');
        if (idx === -1) return null;
        const prop = decl.slice(0, idx).trim().toLowerCase();
        const val = decl.slice(idx + 1).trim();
        return (val && ALLOWED_PASTE_STYLE_PROPS.has(prop)) ? `${prop}: ${val}` : null;
      })
      .filter((v): v is string => v !== null)
      .join('; ');

  // Sanitize clipboard HTML: strip dangerous elements, external-CSS-dependent structure, and
  // source-formatting style noise, but keep bold/italic/underline/links/lists/headings intact.
  const sanitizeClipboardHtml = (rawHtml: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');

    // Remove dangerous / non-visual elements entirely
    ['script', 'noscript', 'style', 'meta', 'link', 'head', 'iframe',
     'object', 'embed', 'form', 'input', 'button', 'select', 'textarea'].forEach(tag => {
      doc.querySelectorAll(tag).forEach(el => el.remove());
    });

    // Strip event handler attributes and javascript: hrefs from every element
    const UNSAFE_ATTRS = ['onclick','onmouseover','onmouseout','onkeydown','onkeyup',
      'onfocus','onblur','onload','onerror','onsubmit','onchange'];
    doc.querySelectorAll('*').forEach(el => {
      UNSAFE_ATTRS.forEach(attr => el.removeAttribute(attr));
      const href = el.getAttribute('href');
      if (href && /^javascript:/i.test(href.trim())) el.removeAttribute('href');
      // Remove class attributes (they reference external CSS that won't apply here)
      el.removeAttribute('class');
      el.removeAttribute('id');
      // Images keep their sizing (legitimate); every other element's style is pared down to
      // just the formatting semantics worth preserving from the source.
      const style = el.getAttribute('style');
      if (style && el.tagName !== 'IMG') {
        const cleaned = sanitizePasteStyleAttr(style);
        if (cleaned) el.setAttribute('style', cleaned); else el.removeAttribute('style');
      }
    });

    // Make all links open in new tab
    doc.querySelectorAll('a').forEach(a => {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    });

    // Fix image src that is relative or blob — leave absolute src untouched
    doc.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src') || '';
      if (!src || src.startsWith('blob:') || src.startsWith('data:')) img.remove();
    });

    return doc.body.innerHTML;
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();

    const clipHtml = e.clipboardData.getData('text/html');
    const clipText = e.clipboardData.getData('text/plain');

    // 1. Rich HTML paste — sanitize and insert with full formatting preserved
    if (clipHtml && clipHtml.trim()) {
      const clean = sanitizeClipboardHtml(clipHtml);
      if (clean.trim()) {
        document.execCommand('insertHTML', false, clean);
        updateState();
        return;
      }
    }

    // 2. No HTML — plain text
    if (!clipText) return;

    // 2a. URL → auto-link
    if (URL_REGEX.test(clipText.trim())) {
      const sel = window.getSelection();
      const url = normalizeUrl(clipText);
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        document.execCommand('createLink', false, url);
        const range = sel.getRangeAt(0);
        const a = (range.startContainer.parentElement?.closest('a')) as HTMLAnchorElement | null;
        if (a) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      } else {
        const safe = url.replace(/"/g, '&quot;');
        const display = clipText.trim().replace(/</g, '&lt;');
        document.execCommand('insertHTML', false, `<a href="${safe}" target="_blank" rel="noopener noreferrer">${display}</a>&nbsp;`);
      }
    } else {
      // 2b. Plain text — preserve line breaks as <br>
      const escaped = clipText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
      document.execCommand('insertHTML', false, escaped);
    }
    updateState();
  };

  const handleEditorMouseOver = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const a = target.closest && (target.closest('a') as HTMLAnchorElement | null);
    if (a && editorRef.current?.contains(a)) {
      const rect = a.getBoundingClientRect();
      setLinkHover({
        open: true,
        top: rect.bottom + 6,
        left: rect.left,
        href: a.href,
        el: a,
      });
    }
  };

  const handleEditorMouseOut = (e: React.MouseEvent) => {
    const related = e.relatedTarget as Node | null;
    // Keep open if moving to the popover itself
    if (related && (related as HTMLElement).closest && (related as HTMLElement).closest('[data-link-popover]')) return;
    const target = e.target as HTMLElement;
    const a = target.closest && target.closest('a');
    if (a) {
      // Small delay so users can move into the popover
      window.setTimeout(() => {
        const hovered = document.querySelector('[data-link-popover]:hover');
        if (!hovered) setLinkHover((p) => ({ ...p, open: false }));
      }, 120);
    }
  };

  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const a = target.closest && (target.closest('a') as HTMLAnchorElement | null);
    if (a && editorRef.current?.contains(a)) {
      // Open on Ctrl/Cmd+click OR plain click (since we provide hover popover too)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        window.open(a.href, '_blank', 'noopener,noreferrer');
      }
    }
  };

  // Linkify the word immediately before the caret if it's a URL.
  // Returns true if a link was created.
  const linkifyWordBeforeCaret = (): boolean => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return false;
    // Don't linkify if already inside an <a>
    const parent = (node.parentNode as HTMLElement | null);
    if (parent && parent.closest && parent.closest('a')) return false;

    const text = node.textContent || '';
    const offset = range.startOffset;
    // Find the start of the current word (whitespace-delimited)
    let start = offset;
    while (start > 0 && !/\s/.test(text.charAt(start - 1))) start--;
    const word = text.slice(start, offset).replace(/[),.;:!?]+$/, '');
    if (!word) return false;
    if (!URL_REGEX.test(word)) return false;

    const url = normalizeUrl(word);
    const wordEnd = start + word.length;
    // Replace just the word with an <a>
    const wordRange = document.createRange();
    wordRange.setStart(node, start);
    wordRange.setEnd(node, wordEnd);
    wordRange.deleteContents();

    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = word;
    wordRange.insertNode(a);

    // Place caret right after the new anchor
    const after = document.createRange();
    after.setStartAfter(a);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
    return true;
  };

  // Save on unmount or when navigating away if there are unsaved changes
  useEffect(() => {
    const onBeforeUnload = () => {
      if (htmlRef.current !== lastSavedRef.current) {
        try { onSave(htmlRef.current); lastSavedRef.current = htmlRef.current; } catch { /* noop */ }
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
      // Final save on unmount
      if (htmlRef.current !== lastSavedRef.current) {
        try { onSave(htmlRef.current); } catch { /* noop */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (wrapperRef.current) {
        const el = wrapperRef.current;
        el.style.setProperty('--gutter-top', `${interactionGutter.top + 38}px`);
        el.style.setProperty('--sel-top', `${selectionMenu.top}px`);
        el.style.setProperty('--sel-left', `${selectionMenu.left}px`);
        el.style.setProperty('--slash-top', `${slashMenu.top}px`);
        el.style.setProperty('--slash-left', `${slashMenu.left}px`);
        el.style.setProperty('--block-top', `${blockMenu.top}px`);
        el.style.setProperty('--block-left', `${blockMenu.left}px`);
    }
  }, [interactionGutter, selectionMenu, slashMenu, blockMenu]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
      // Handle Ctrl+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          performAutoSave();
      }

      // Handle Enter
      if (e.key === 'Enter') {
          // If the word before the caret is a URL, convert it to a link first
          linkifyWordBeforeCaret();
          setTimeout(() => {
              document.execCommand('formatBlock', false, 'P');
              updateState();
          }, 10);
      }

      // Handle Markdown Shorthand
      if (e.key === ' ') {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              const text = range.startContainer.textContent || '';
              const shortcuts: Record<string, string> = {
                '# ': 'h1', '## ': 'h2', '### ': 'h3',
                '- ': 'unorderedList', '* ': 'unorderedList', '1. ': 'orderedList',
                '> ': 'quote', '[] ': 'checklist'
              };
              let matchedShortcut = false;
              for (const [s, c] of Object.entries(shortcuts)) {
                  if (text.startsWith(s)) {
                      range.setStart(range.startContainer, 0);
                      range.setEnd(range.startContainer, s.length);
                      range.deleteContents();
                      executeCommand(c, true);
                      e.preventDefault();
                      matchedShortcut = true;
                      break;
                  }
              }
              // If not a shortcut, try linkifying the word before the caret
              if (!matchedShortcut) {
                  if (linkifyWordBeforeCaret()) {
                      // Insert the space after the new link, then suppress default to avoid double space
                      document.execCommand('insertText', false, ' ');
                      e.preventDefault();
                      updateState();
                  }
              }
          }
      }
  };

  // --- COMMANDS ---
  const executeCommand = async (cmd: string, shortcut: boolean | string = false) => {
    setSlashMenu(prev => ({ ...prev, open: false }));
    setBlockMenu(prev => ({ ...prev, open: false }));
    if (!editorRef.current) return;

    if (!shortcut && slashMenu.open) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (range.startOffset > 0) {
                range.setStart(range.startContainer, range.startOffset - 1);
                range.deleteContents();
            }
        }
    }

    switch (cmd) {
        case 'h1': case 'h2': case 'h3': case 'h4':
            document.execCommand('formatBlock', false, cmd.toUpperCase()); break;
        case 'p': document.execCommand('formatBlock', false, 'P'); break;
        case 'unorderedList': document.execCommand('insertUnorderedList', false); break;
        case 'orderedList': document.execCommand('insertOrderedList', false); break;
        case 'quote': document.execCommand('formatBlock', false, 'BLOCKQUOTE'); break;
        case 'toggle':
            document.execCommand('insertHTML', false, '<details class="ed-toggle"><summary>Toggle list</summary><div>Content...</div></details><p><br></p>'); break;
        case 'banner':
            document.execCommand('insertHTML', false, '<div class="ed-banner">💡 <span>Important details...</span></div><p><br></p>'); break;
        case 'code':
            document.execCommand('insertHTML', false, '<pre class="ed-code"><code>// code...</code></pre><p><br></p>'); break;
        case 'checklist':
            document.execCommand('insertHTML', false, '<div class="ed-checklist"><input type="checkbox" onclick="event.stopPropagation()" /> <span contenteditable="true">Task...</span></div><p><br></p>'); break;
        case 'pullquote':
            document.execCommand('insertHTML', false, '<blockquote class="ed-pullquote">"Quote..."</blockquote><p><br></p>'); break;
        case 'video':
            document.execCommand('insertHTML', false, '<div class="ed-video" style="background:#000; color:#fff; padding:40px; text-align:center; border-radius:12px;">🎬 [Video Placeholder: Upload or Paste Link]</div><p><br></p>'); break;
        case 'img': triggerUpload(); break;
        case 'bold': document.execCommand('bold'); break;
        case 'italic': document.execCommand('italic'); break;
        case 'underline': document.execCommand('underline'); break;
        case 'strikeThrough': document.execCommand('strikeThrough'); break;
        case 'subscript': document.execCommand('subscript'); break;
        case 'superscript': document.execCommand('superscript'); break;
        case 'indent': document.execCommand('indent'); break;
        case 'outdent': document.execCommand('outdent'); break;
        case 'createLink': document.execCommand('createLink', false, shortcut as any); break;
        case 'delete':
            const nodeToDel = interactionGutter.targetNode;
            if (nodeToDel && editorRef.current?.contains(nodeToDel)) {
                nodeToDel.remove();
                updateState();
            }
            break;
        case 'duplicate':
            const nodeToDup = interactionGutter.targetNode;
            if (nodeToDup && editorRef.current?.contains(nodeToDup)) {
                const clone = nodeToDup.cloneNode(true);
                nodeToDup.after(clone);
                updateState();
            }
            break;
    }
    editorRef.current.focus();
    updateState();
  };

  const triggerUpload = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            setIsUploading(true);
            try {
                const fd = new FormData(); fd.append('file', file);
                const res = await api.post(`/attachments/task/${taskId}`, fd);
                document.execCommand('insertHTML', false, `<img src="/uploads/${res.data.data.filename}" class="ed-img" /><p><br></p>`);
                updateState();
            } catch (err) { console.error(err); } finally { setIsUploading(false); }
        }
    };
    input.click();
  };

  // --- COLOR HELPERS ---
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (sel && savedRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
  };

  const applyColor = (kind: 'text' | 'highlight' | 'badge', color: string | null, opts?: { textColor?: string }) => {
    editorRef.current?.focus();
    restoreSelection();

    if (kind === 'text') {
      document.execCommand('foreColor', false, color || '#334155');
    } else if (kind === 'highlight') {
      try { document.execCommand('hiliteColor', false, color || 'transparent'); }
      catch { document.execCommand('backColor', false, color || 'transparent'); }
      if (!color) {
        try { document.execCommand('backColor', false, 'transparent'); } catch { /* noop */ }
      }
    } else if (kind === 'badge') {
      // Wrap selection in a styled badge span
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        setColorPicker(prev => ({ ...prev, open: false }));
        return;
      }
      const range = sel.getRangeAt(0);
      if (range.collapsed) {
        setColorPicker(prev => ({ ...prev, open: false }));
        return;
      }
      const text = range.toString();
      if (!text) {
        setColorPicker(prev => ({ ...prev, open: false }));
        return;
      }
      const span = document.createElement('span');
      span.className = 'ed-badge';
      span.style.background = color || 'transparent';
      span.style.color = opts?.textColor || '#ffffff';
      span.style.padding = '2px 10px';
      span.style.borderRadius = '999px';
      span.style.fontWeight = '600';
      span.style.fontSize = '0.92em';
      span.style.display = 'inline-block';
      span.style.lineHeight = '1.4';
      span.textContent = text;
      range.deleteContents();
      range.insertNode(span);
      // Place caret right after the inserted badge
      const after = document.createRange();
      after.setStartAfter(span);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
    }

    setColorPicker(prev => ({ ...prev, open: false }));
    updateState();
  };

  const removeAllColor = () => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand('foreColor', false, '#334155');
    try { document.execCommand('hiliteColor', false, 'transparent'); } catch { /* noop */ }
    try { document.execCommand('backColor', false, 'transparent'); } catch { /* noop */ }
    setColorPicker(prev => ({ ...prev, open: false }));
    updateState();
  };

  const TEXT_COLORS = ['#334155', '#ef4444', '#f97316', '#f59e0b', '#16a34a', '#0ea5e9', '#6366f1', '#a855f7', '#ec4899'];
  const HIGHLIGHT_COLORS = ['#fecaca', '#fed7aa', '#fde68a', '#bae6fd', '#c7d2fe', '#fbcfe8', '#bbf7d0', '#e5e7eb'];
  // Vivid badges (top row in screenshot)
  const BADGE_COLORS_BOLD = ['#7f1d1d', '#ea580c', '#f59e0b', '#1d4ed8', '#4338ca', '#be185d', '#15803d', '#9ca3af'];
  // Soft badges (bottom row in screenshot)
  const BADGE_COLORS_SOFT = ['#fecaca', '#fed7aa', '#fde68a', '#bfdbfe', '#c7d2fe', '#fbcfe8', '#bbf7d0', '#e5e7eb'];

  // --- RENDER ---
  return (
    <div 
        ref={wrapperRef}
        className="task-description-editor group relative transition-all duration-300 bg-white dark:bg-[#111827] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl flex flex-col min-h-[550px]"
    >
        <style>{`
            .editor-surface { padding: 32px 24px; flex: 1; outline: none; font-size: 16px; line-height: 1.8; color: #334155; }
            .dark .editor-surface { color: #cbd5e1; }
            .editor-surface h1 { font-size: 38px; font-weight: 800; margin: 30px 0 15px; color: #0f172a; }
            .editor-surface h2 { font-size: 28px; font-weight: 700; margin: 25px 0 10px; color: #1e293b; }
            .dark .editor-surface h1, .dark .editor-surface h2 { color: #f8fafc; }
            .ed-banner { padding: 14px 20px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; color: #92400e; margin: 20px 0; display: flex; gap: 10px; }
            .ed-code { background: #1e293b; color: #e2e8f0; padding: 18px; border-radius: 12px; font-family: 'JetBrains Mono', monospace; margin: 20px 0; }
            .ed-toggle { background: rgba(99, 102, 241, 0.05); padding: 10px 15px; border-radius: 10px; margin: 10px 0; cursor: pointer; }
            .ed-toggle summary { font-weight: 700; color: #4f46e5; }
            .ed-checklist { display: flex; align-items: center; gap: 12px; margin: 10px 0; }
            .ed-checklist input { width: 18px; height: 18px; cursor: pointer; accent-color: #6366f1; }
            .ed-img { max-width: 100%; border-radius: 14px; margin: 25px 0; box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
            .ed-pullquote { text-align: center; border: none; font-size: 22px; font-style: italic; color: #6366f1; padding: 30px 0; margin: 30px 0; background: rgba(99, 102, 241, 0.03); border-radius: 16px; }
            .editor-surface a { color: #2563eb; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; transition: color 0.15s; }
            .editor-surface a:hover { color: #1d4ed8; cursor: pointer; }
            .dark .editor-surface a { color: #60a5fa; }
            .dark .editor-surface a:hover { color: #93c5fd; }
            .custom-scrollbar::-webkit-scrollbar { width: 5px; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
            
            .gutter-container { top: var(--gutter-top); }
            .selection-menu { top: var(--sel-top); left: var(--sel-left); }
            .slash-menu { top: var(--slash-top); left: var(--slash-left); }
            .block-menu { top: var(--block-top); left: var(--block-left); }
        `}</style>

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between bg-gray-50/30 dark:bg-gray-900/10 backdrop-blur-md">
            <div className="flex items-center gap-2">
                <div className="w-2 h-5 bg-indigo-500 rounded-full" />
                <span className="text-xs font-black uppercase tracking-[0.2em] text-gray-900 dark:text-white">Description</span>
            </div>
            <div className="flex items-center gap-2">
                {saveStatus === 'saving' ? (
                    <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-bold">
                        <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" /></svg>
                        SAVING…
                    </div>
                ) : saveStatus === 'error' ? (
                    <div className="flex items-center gap-2 px-3 py-1 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-full text-[10px] font-bold">SAVE FAILED</div>
                ) : html !== lastSavedRef.current ? (
                    <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full text-[10px] font-bold animate-pulse">UNSAVED CHANGES</div>
                ) : (
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full text-[10px] font-bold">{saveStatus === 'saved' ? 'SAVED' : 'ALL SYNCED'}</div>
                )}
            </div>
        </div>

        {/* Editor Canvas */}
        <div className="relative flex-1">
            {/* Removed the left-margin (+ / drag) gutter icons as requested */}

            <div
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                onMouseUp={handleMouseUp}
                onKeyDown={handleKeyDown}
                onBlur={handleEditorBlur}
                onPaste={handlePaste}
                onMouseOver={handleEditorMouseOver}
                onMouseOut={handleEditorMouseOut}
                onClick={handleEditorClick}
                className="editor-surface"
                spellCheck="false"
            />

            {isEmpty && (
                <div className="absolute top-8 left-6 pointer-events-none text-gray-400 select-none text-[16px]">
                    Write here description…
                </div>
            )}
        </div>

        {/* --- FLOATING COMPONENTS --- */}
        
        {/* Formatting Toolbar (Expanded as per Img 2) */}
        {selectionMenu.open && (
            <div className="fixed z-[120] bg-gray-900/95 dark:bg-[#0f172a]/95 text-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-md flex items-center p-1 gap-0.5 animate-in slide-in-from-bottom-2 border border-white/10 selection-menu">
                <ToolbarBtn icon="B" label="Bold" onClick={() => executeCommand('bold')} active={document.queryCommandState('bold')} />
                <ToolbarBtn icon="I" label="Italic" onClick={() => executeCommand('italic')} active={document.queryCommandState('italic')} />
                <ToolbarBtn icon="U" label="Underline" onClick={() => executeCommand('underline')} active={document.queryCommandState('underline')} />
                <ToolbarBtn icon="S" label="Strikethrough" onClick={() => executeCommand('strikeThrough')} strike active={document.queryCommandState('strikeThrough')} />
                
                <div className="w-[1px] h-4 bg-white/20 mx-1" />

                {/* Text color + highlight color */}
                <button
                    title="Text color & highlight"
                    aria-label="Text color & highlight"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        saveSelection();
                        // Position popup just below the selection toolbar
                        setColorPicker({
                            open: !colorPicker.open,
                            top: selectionMenu.top + 50,
                            left: selectionMenu.left + 220,
                        });
                    }}
                    className={`flex items-center gap-1 h-8 px-2 rounded-lg transition-all hover:bg-white/20 ${colorPicker.open ? 'bg-white/15' : ''} text-gray-200`}
                >
                    <span className="text-[13px] font-black leading-none" style={{ color: '#fca5a5' }}>A</span>
                    <span className="w-3 h-3 rounded-sm border border-white/30" style={{ background: 'linear-gradient(135deg,#fde68a 50%,#bae6fd 50%)' }} />
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
                </button>

                <div className="w-[1px] h-4 bg-white/20 mx-1" />
                
                <ToolbarBtn icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>} label="Ordered List" onClick={() => executeCommand('orderedList')} />
                <ToolbarBtn icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>} label="Unordered List" onClick={() => executeCommand('unorderedList')} />
                <ToolbarBtn icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 8 3 12 7 16"/><line x1="21" y1="12" x2="11" y2="12"/><line x1="21" y1="6" x2="11" y2="6"/><line x1="21" y1="18" x2="11" y2="18"/></svg>} label="Outdent" onClick={() => executeCommand('outdent')} />
                <ToolbarBtn icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 8 21 12 17 16"/><line x1="3" y1="12" x2="13" y2="12"/><line x1="3" y1="6" x2="13" y2="6"/><line x1="3" y1="18" x2="13" y2="18"/></svg>} label="Indent" onClick={() => executeCommand('indent')} />
                
                <div className="w-[1px] h-4 bg-white/20 mx-1" />
                
                <ToolbarBtn icon={<span className="text-[12px] font-bold">x₂</span>} label="Subscript" onClick={() => executeCommand('subscript')} />
                <ToolbarBtn icon={<span className="text-[12px] font-bold">x²</span>} label="Superscript" onClick={() => executeCommand('superscript')} />

                {/* Heading Dropdown */}
                <div className="relative">
                    <button
                        title="Text type"
                        aria-label="Text type"
                        onMouseDown={(e) => { e.preventDefault(); setFloatingHeadingDropdown(!floatingHeadingDropdown); }}
                        className={`flex items-center gap-1 h-8 px-2 rounded-lg transition-all hover:bg-white/20 ${floatingHeadingDropdown ? 'bg-white/15' : ''} text-gray-200`}
                    >
                        <span className="text-[12px] font-bold">Text</span>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                    {floatingHeadingDropdown && (
                        <div className="absolute bottom-full left-0 mb-2 z-[200] bg-gray-900/95 dark:bg-[#0f172a] rounded-xl shadow-2xl border border-white/10 w-[160px] py-1 backdrop-blur-md animate-in fade-in slide-in-from-bottom-1">
                            {[
                                { key: 'h1', label: 'Heading 1', size: 'text-[16px]' },
                                { key: 'h2', label: 'Heading 2', size: 'text-[14px]' },
                                { key: 'h3', label: 'Heading 3', size: 'text-[13px]' },
                                { key: 'h4', label: 'Heading 4', size: 'text-[12px]' },
                            ].map(item => (
                                <button
                                    key={item.key}
                                    title={item.label}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        executeCommand(item.key, true);
                                        setFloatingHeadingDropdown(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/10 transition-colors text-gray-200"
                                >
                                    <span className={`${item.size} font-bold text-white uppercase`}>{item.key.toUpperCase()}</span>
                                    <span className="text-[12px] text-gray-400">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="w-[1px] h-4 bg-white/10 mx-1" />
                
                <ToolbarBtn icon="”" label="Quote" onClick={() => executeCommand('quote', true)} />
                <ToolbarBtn icon="&lt;/&gt;" label="Code Block" onClick={() => executeCommand('code', true)} />
                <ToolbarBtn icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>} label="Insert Link" onClick={() => { 
                    const sel = window.getSelection();
                    if (!sel || sel.rangeCount === 0) return;
                    const range = sel.getRangeAt(0).cloneRange();
                    const url = prompt('Enter URL:'); 
                    if(url) {
                        sel.removeAllRanges();
                        sel.addRange(range);
                        executeCommand('createLink', url); 
                    }
                }} />
                <ToolbarBtn icon="&#128247;" label="Insert Image" onClick={() => executeCommand('img', true)} />
                <ToolbarBtn icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>} label="Insert Video" onClick={() => executeCommand('video', true)} />
            </div>
        )}

        {/* Color picker popover */}
        {selectionMenu.open && colorPicker.open && (
            <div
                className="fixed z-[130] bg-white dark:bg-[#0f172a] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] border border-gray-100 dark:border-gray-800 p-3 w-[300px] animate-in zoom-in-95"
                style={{ top: colorPicker.top, left: Math.max(8, Math.min(colorPicker.left, window.innerWidth - 320)) }}
                onMouseDown={(e) => e.preventDefault()}
            >
                {/* Text colors */}
                <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-2">Text colors</div>
                <div className="flex items-center gap-1.5 mb-3">
                    {TEXT_COLORS.map((c) => (
                        <button
                            key={`t-${c}`}
                            title={`Text ${c}`}
                            aria-label={`Text color ${c}`}
                            onMouseDown={(e) => { e.preventDefault(); applyColor('text', c); }}
                            className="w-7 h-7 rounded-md border border-gray-200 dark:border-gray-700 flex items-center justify-center bg-white dark:bg-gray-800 hover:scale-110 transition-transform"
                        >
                            <span className="text-[13px] font-black" style={{ color: c }}>A</span>
                        </button>
                    ))}
                </div>

                {/* Text highlights */}
                <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-2">Text highlights</div>
                <div className="flex items-center gap-1.5 mb-3">
                    {HIGHLIGHT_COLORS.map((c) => (
                        <button
                            key={`h-${c}`}
                            title={`Highlight ${c}`}
                            aria-label={`Highlight ${c}`}
                            onMouseDown={(e) => { e.preventDefault(); applyColor('highlight', c); }}
                            className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 hover:scale-110 transition-transform"
                            style={{ backgroundColor: c }}
                        />
                    ))}
                    <button
                        title="No highlight"
                        aria-label="Remove highlight"
                        onMouseDown={(e) => { e.preventDefault(); applyColor('highlight', null); }}
                        className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:scale-110 transition-transform bg-white dark:bg-gray-800"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                    </button>
                </div>

                {/* Badges */}
                <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-2">Badges</div>
                <div className="flex items-center gap-1.5 mb-1.5">
                    {BADGE_COLORS_BOLD.map((c) => (
                        <button
                            key={`bb-${c}`}
                            title={`Badge ${c}`}
                            aria-label={`Badge color ${c}`}
                            onMouseDown={(e) => { e.preventDefault(); applyColor('badge', c, { textColor: '#ffffff' }); }}
                            className="w-7 h-7 rounded-md hover:scale-110 transition-transform border border-black/10"
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
                <div className="flex items-center gap-1.5 mb-3">
                    {BADGE_COLORS_SOFT.map((c) => (
                        <button
                            key={`bs-${c}`}
                            title={`Badge ${c}`}
                            aria-label={`Badge color ${c}`}
                            onMouseDown={(e) => { e.preventDefault(); applyColor('badge', c, { textColor: '#1f2937' }); }}
                            className="w-7 h-7 rounded-md hover:scale-110 transition-transform border border-gray-200 dark:border-gray-700"
                            style={{ backgroundColor: c }}
                        />
                    ))}
                    <button
                        title="No badge"
                        aria-label="Remove badge styling"
                        onMouseDown={(e) => { e.preventDefault(); removeAllColor(); }}
                        className="w-7 h-7 rounded-md border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-400 hover:scale-110 transition-transform bg-white dark:bg-gray-800"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                    </button>
                </div>

                {/* Remove color */}
                <button
                    onMouseDown={(e) => { e.preventDefault(); removeAllColor(); }}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-[12px] font-medium"
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                    Remove color
                </button>
            </div>
        )}

        {/* Link hover popover */}
        {linkHover.open && linkHover.href && (
            <div
                data-link-popover
                className="fixed z-[140] bg-gray-900/95 text-white rounded-lg shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-md border border-white/10 px-2 py-1.5 flex items-center gap-1 text-[12px] animate-in fade-in slide-in-from-top-1"
                style={{ top: linkHover.top, left: Math.max(8, Math.min(linkHover.left, window.innerWidth - 360)), maxWidth: 360 }}
                onMouseLeave={() => setLinkHover((p) => ({ ...p, open: false }))}
            >
                <a
                    href={linkHover.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-white/15 text-blue-300 hover:text-blue-200 truncate max-w-[220px]"
                    title={linkHover.href}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    <span className="truncate">{linkHover.href.replace(/^https?:\/\//, '')}</span>
                </a>
                <div className="w-px h-4 bg-white/15" />
                <button
                    title="Copy link"
                    onClick={async () => {
                        try { await navigator.clipboard.writeText(linkHover.href); } catch { /* noop */ }
                    }}
                    className="p-1.5 rounded-md hover:bg-white/15 text-gray-200"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
                <button
                    title="Edit link"
                    onClick={() => {
                        if (!linkHover.el) return;
                        const next = window.prompt('Edit URL', linkHover.href);
                        if (next && next.trim()) {
                            const url = normalizeUrl(next.trim());
                            linkHover.el.href = url;
                            setLinkHover((p) => ({ ...p, href: url }));
                            updateState();
                        }
                    }}
                    className="p-1.5 rounded-md hover:bg-white/15 text-gray-200"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button
                    title="Remove link"
                    onClick={() => {
                        if (!linkHover.el) return;
                        const a = linkHover.el;
                        const parent = a.parentNode;
                        if (parent) {
                            while (a.firstChild) parent.insertBefore(a.firstChild, a);
                            parent.removeChild(a);
                            updateState();
                        }
                        setLinkHover((p) => ({ ...p, open: false }));
                    }}
                    className="p-1.5 rounded-md hover:bg-white/15 text-rose-300"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                </button>
            </div>
        )}

        {/* Slash Menu */}
        {slashMenu.open && (
            <div className="fixed z-[100] bg-white dark:bg-[#111827] rounded-xl shadow-2xl border border-gray-100 dark:border-gray-800 w-[400px] p-2 animate-in zoom-in-95 slash-menu">
                <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
                    <div className="px-3 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">Text</div>
                    <div className="grid grid-cols-2 gap-1">
                        <Btn icon="T" label="Normal text" onClick={() => executeCommand('p')} />
                        <Btn icon="1." label="Numbered list" onClick={() => executeCommand('orderedList')} />
                        <Btn icon="H1" label="Heading 1" onClick={() => executeCommand('h1')} />
                        <Btn icon="::" label="Toggle list" onClick={() => executeCommand('toggle')} />
                        <Btn icon="H2" label="Heading 2" onClick={() => executeCommand('h2')} />
                        <Btn icon="&#128270;" label="Banners" onClick={() => executeCommand('banner')} />
                        <Btn icon="&#9745;" label="Checklist" onClick={() => executeCommand('checklist')} />
                        <Btn icon="&lt;/&gt;" label="Code block" onClick={() => executeCommand('code')} />
                    </div>
                    <div className="px-3 py-2 mt-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-t border-gray-50 dark:border-gray-800">Inline</div>
                    <div className="grid grid-cols-2 gap-1">
                        <Btn icon="&#128100;" label="Mention a Person" onClick={() => {}} />
                        <Btn icon="&#128196;" label="Mention a Task" onClick={() => {}} />
                    </div>
                </div>
            </div>
        )}

        {/* Block Options (Expanded) */}
        {blockMenu.open && (
            <div className="fixed z-[100] bg-white dark:bg-[#111827] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-100 dark:border-gray-800 w-[240px] p-1.5 animate-in slide-in-from-left-2 backdrop-blur-sm block-menu">
                <div className="px-3 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Options</div>
                <Opt icon="&#8635;" label="Turn into" arrow />
                <Opt icon="&#127393;" label="Block color" arrow />
                <Opt icon="&#10024;" label="Ask AI" color="purple" onClick={() => alert('AI Assistant Coming Soon!')} />
                
                <div className="h-[1px] bg-gray-50 dark:bg-gray-800 my-1 mx-1" />
                
                <Opt icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>} label="Duplicate" onClick={() => executeCommand('duplicate')} />
                <Opt icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>} label="Copy block link" onClick={() => { navigator.clipboard.writeText(window.location.href); }} />
                
                <div className="h-[1px] bg-gray-50 dark:bg-gray-800 my-1 mx-1" />
                
                <Opt icon="&#128465;" label="Delete" color="red" shortcut="Del" onClick={() => executeCommand('delete')} />
            </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between bg-gray-50/20 dark:bg-gray-900/10">
            <div className="text-[10px] font-bold text-gray-400 tracking-[0.2em] uppercase opacity-70 flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Autosaves when you click outside
            </div>
            <div className="text-[10px] font-bold text-gray-400 tracking-[0.2em] uppercase opacity-50">Press Ctrl+S to save now</div>
        </div>

        {isUploading && (
            <div className="absolute inset-0 z-[150] bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Syncing...</span>
                </div>
            </div>
        )}
    </div>
  );
}

function Btn({ icon, label, onClick }: { icon: string, label: string, onClick: () => void }) {
    return (
        <button 
            title={label}
            aria-label={label}
            onMouseDown={(e) => { e.preventDefault(); onClick(); }} 
            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-all text-left group w-full"
        >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 group-hover:border-indigo-500/30 group-hover:text-indigo-600 transition-all font-bold text-gray-400 text-xs">{icon}</div>
            <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300 group-hover:text-indigo-600">{label}</span>
        </button>
    );
}

function Opt({ icon, label, onClick, color, shortcut, arrow }: { icon: any, label: string, onClick?: () => void, color?: string, shortcut?: string, arrow?: boolean }) {
    return (
        <button 
            title={label}
            aria-label={label}
            onMouseDown={(e) => { e.preventDefault(); onClick?.(); }} 
            className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${color === 'red' ? 'text-red-500 bg-red-50/50 dark:bg-red-900/10' : 'text-gray-700 dark:text-gray-300'}`}
        >
            <span className={`text-[15px] w-5 flex justify-center ${color === 'purple' ? 'text-purple-500' : ''}`}>{icon}</span>
            <span className="text-[13px] font-medium flex-1 text-left">{label}</span>
            {shortcut && <span className="text-[10px] text-gray-400 font-bold px-1.5 py-0.5 rounded border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">{shortcut}</span>}
            {arrow && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="text-gray-300"><path d="M9 18l6-6-6-6"/></svg>}
        </button>
    );
}

function ToolbarBtn({ icon, label, onClick, active, strike }: { icon: any, label: string, onClick: () => void, active?: boolean, strike?: boolean }) {
    return (
        <button 
            title={label}
            aria-label={label}
            onMouseDown={(e) => { e.preventDefault(); onClick(); }} 
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:bg-white/20 ${active ? 'bg-indigo-500 text-white' : 'text-gray-300'}`}
        >
            <span className={`text-[13px] font-black ${strike ? 'line-through' : ''}`}>{icon}</span>
        </button>
    );
}
