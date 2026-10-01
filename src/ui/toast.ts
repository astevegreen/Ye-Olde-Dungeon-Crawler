export type ToastType = 'info' | 'success' | 'warning' | 'error';

let toastContainer: HTMLElement | null = null;

function ensureToastContainer(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (!toastContainer || !document.body.contains(toastContainer)) {
    let el = document.getElementById('retro-toast-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'retro-toast-container';
      Object.assign(el.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: '9999',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
        maxWidth: '400px',
        fontFamily: '"Courier New", Courier, monospace',
      });
      document.body.appendChild(el);
    }
    toastContainer = el;
  }
  return toastContainer;
}

export function showToast(message: string, type: ToastType = 'info', durationMs = 4000): HTMLElement | null {
  const container = ensureToastContainer();
  if (!container || typeof document === 'undefined') return null;

  const toast = document.createElement('div');
  toast.className = `retro-toast retro-toast-${type}`;

  // A status toast tints the panel with its status color (ADR-0011 role tokens).
  const tint = (role: string): string => `color-mix(in srgb, var(--ui-${role}) 22%, var(--ui-surface-1))`;
  let bg = 'var(--ui-surface-2)';
  let border = 'var(--ui-line-strong)';
  const color = 'var(--ui-text)';
  let icon = 'ℹ️';

  switch (type) {
    case 'success':
      bg = tint('good');
      border = 'var(--ui-good)';
      icon = '✅';
      break;
    case 'warning':
      bg = tint('warn');
      border = 'var(--ui-warn)';
      icon = '⚠️';
      break;
    case 'error':
      bg = tint('bad');
      border = 'var(--ui-bad)';
      icon = '❌';
      break;
  }

  Object.assign(toast.style, {
    backgroundColor: bg,
    border: `2px solid ${border}`,
    color: color,
    padding: '10px 14px',
    borderRadius: '4px',
    boxShadow: 'var(--ui-shadow)',
    fontSize: '13px',
    lineHeight: '1.4',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    pointerEvents: 'auto',
    cursor: 'pointer',
    transition: 'opacity 0.25s ease, transform 0.25s ease',
    opacity: '0',
    transform: 'translateY(-10px)',
  });

  toast.innerHTML = `
    <span style="font-size: 16px;">${icon}</span>
    <span style="flex: 1; word-break: break-word;">${message}</span>
    <span style="font-size: 12px; opacity: 0.6; margin-left: 6px;">✕</span>
  `;

  const removeToast = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 250);
  };

  toast.addEventListener('click', removeToast);

  container.appendChild(toast);

  // Trigger animation frame for transition
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
  } else {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }

  if (durationMs > 0) {
    setTimeout(removeToast, durationMs);
  }

  return toast;
}
