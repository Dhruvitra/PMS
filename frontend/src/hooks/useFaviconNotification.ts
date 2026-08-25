import { useEffect, useRef, useMemo } from 'react';
import { useAppSelector } from '../store';

const ORIGINAL_FAVICON = '/tab-icon.png';
const ORIGINAL_TITLE = 'Producteev';
const BLINK_INTERVAL = 900;
const TITLE_BLINK_INTERVAL = 1500;

function applyFavicon(dataUrl: string) {
  document.querySelectorAll<HTMLLinkElement>(
    "link[rel='icon'], link[rel='shortcut icon']"
  ).forEach((el) => el.remove());

  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = dataUrl;
  document.head.appendChild(link);
}

function loadImageAsBase64(): Promise<string> {
  return fetch(ORIGINAL_FAVICON)
    .then((res) => res.blob())
    .then(
      (blob) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        })
    );
}

function drawBadgeFavicon(base64Img: string, count: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const s = 32;
      const canvas = document.createElement('canvas');
      canvas.width = s;
      canvas.height = s;
      const ctx = canvas.getContext('2d')!;

      ctx.drawImage(img, 0, 0, s, s);

      const r = 8;
      const cx = s - r - 1;
      const cy = r + 1;

      ctx.beginPath();
      ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();

      if (count > 0 && count <= 99) {
        const label = String(count);
        ctx.font = `bold ${count > 9 ? 8 : 10}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, cx, cy + 0.5);
      } else if (count > 99) {
        ctx.font = 'bold 7px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('99+', cx, cy + 0.5);
      }

      resolve(canvas.toDataURL('image/png'));
    };
    img.src = base64Img;
  });
}

export function useFaviconNotification() {
  const notifBadgeCount = useAppSelector((s) => s.notification.badgeCount);
  const messageUnreadCounts = useAppSelector((s) => s.message.unreadCounts);

  const totalMessageUnread = useMemo(() => {
    return Object.values(messageUnreadCounts).reduce((sum, c) => sum + c, 0);
  }, [messageUnreadCounts]);

  const totalCount = notifBadgeCount + totalMessageUnread;

  const r = useRef({
    count: 0,
    base64: '',
    badgeUrl: '',
    cleanUrl: '',
    fTimer: null as ReturnType<typeof setInterval> | null,
    tTimer: null as ReturnType<typeof setInterval> | null,
    showDot: false,
    titleAlt: false,
    ready: false,
  });

  r.current.count = totalCount;

  function stop() {
    if (r.current.fTimer) clearInterval(r.current.fTimer);
    if (r.current.tTimer) clearInterval(r.current.tTimer);
    r.current.fTimer = null;
    r.current.tTimer = null;
    r.current.showDot = false;
    r.current.titleAlt = false;
    document.title = ORIGINAL_TITLE;
    applyFavicon(ORIGINAL_FAVICON);
  }

  async function start() {
    stop();
    if (!r.current.base64) return;

    const count = r.current.count;
    r.current.badgeUrl = await drawBadgeFavicon(r.current.base64, count);
    r.current.cleanUrl = r.current.base64;

    r.current.showDot = true;
    applyFavicon(r.current.badgeUrl);
    document.title = `(${count > 99 ? '99+' : count}) ${ORIGINAL_TITLE}`;

    r.current.fTimer = setInterval(() => {
      if (r.current.showDot) {
        applyFavicon(r.current.cleanUrl);
      } else {
        applyFavicon(r.current.badgeUrl);
      }
      r.current.showDot = !r.current.showDot;
    }, BLINK_INTERVAL);

    r.current.tTimer = setInterval(() => {
      const c = r.current.count;
      const cs = c > 99 ? '99+' : String(c);
      if (r.current.titleAlt) {
        document.title = `(${cs}) ${ORIGINAL_TITLE}`;
      } else {
        document.title = `\u{1F534} (${cs}) New Notifications`;
      }
      r.current.titleAlt = !r.current.titleAlt;
    }, TITLE_BLINK_INTERVAL);
  }

  useEffect(() => {
    loadImageAsBase64()
      .then((base64) => {
        r.current.base64 = base64;
        r.current.ready = true;
        if (r.current.count > 0) start();
      })
      .catch(() => {});

    return () => stop();
  }, []);

  useEffect(() => {
    if (!r.current.ready) return;
    if (totalCount > 0) {
      start();
    } else {
      stop();
    }
  }, [totalCount]);
}
