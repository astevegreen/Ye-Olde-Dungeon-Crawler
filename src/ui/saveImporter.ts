import { SAVE_FILE_EXTENSION, validateSavePayload, type SaveValidationResult } from '../engine';
import { iconHtml } from './icons';
import { createDialogScrim, dialogButton, dialogHtml } from './dialog';
import { escapeHtml } from './html';
import type { ProfileManager } from '../engine';
import type { CharacterProfile } from '../engine';
import type { ModalStackManager } from './modalStack';

/**
 * Triggers a browser file download of text content (e.g. exported save files).
 */
export function triggerSaveDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface DragAndDropOptions {
  container: HTMLElement;
  onSaveFile: (content: string, filename: string) => void;
  overlayElement?: HTMLElement;
}

/**
 * Attaches drag-and-drop listeners to a container element with visual feedback overlay.
 * Returns an unmount / cleanup callback.
 */
export function setupSaveDragAndDrop(options: DragAndDropOptions): () => void {
  const { container, onSaveFile } = options;

  let overlay = options.overlayElement;
  let createdOverlay = false;

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'save-drop-overlay';
    overlay.innerHTML = `
      <div class="save-drop-box">
        <div class="save-drop-icon">${iconHtml('import')}</div>
        <div class="save-drop-title">Drop a save file here</div>
        <div class="ui-note">A ${SAVE_FILE_EXTENSION}, .sav or .json save restores its hero.</div>
      </div>
    `;
    // Hidden until a drag enters; styled by .save-drop-overlay (base.css).
    overlay.style.display = 'none';

    // Only establish a containing block when there isn't one: forcing `relative` onto an
    // already-positioned overlay (the title screen is `position: absolute; inset: 0`)
    // dropped it into document flow, stacking the roster below the game view.
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    container.appendChild(overlay);
    createdOverlay = true;
  }

  let dragCounter = 0;

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    if (overlay) {
      overlay.style.display = 'flex';
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    if (overlay && overlay.style.display === 'none') {
      overlay.style.display = 'flex';
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter <= 0 && overlay) {
      dragCounter = 0;
      overlay.style.display = 'none';
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    if (overlay) {
      overlay.style.display = 'none';
    }

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      onSaveFile(content, file.name);
    };
    reader.readAsText(file);
  };

  container.addEventListener('dragenter', handleDragEnter);
  container.addEventListener('dragover', handleDragOver);
  container.addEventListener('dragleave', handleDragLeave);
  container.addEventListener('drop', handleDrop);

  return () => {
    container.removeEventListener('dragenter', handleDragEnter);
    container.removeEventListener('dragover', handleDragOver);
    container.removeEventListener('dragleave', handleDragLeave);
    container.removeEventListener('drop', handleDrop);
    if (createdOverlay && overlay && overlay.parentElement) {
      overlay.parentElement.removeChild(overlay);
    }
  };
}

export interface ManifestMismatchDialogOptions {
  detectedManifestId: string;
  /** What the player knows this game as: the pack's name. */
  activeGameName: string;
  heroName: string;
  onConfirm: () => void;
  onCancel?: () => void;
  /** In play, the dialog takes every key while it is open (Escape cancels), so none
   *  reaches the game behind it. */
  modalStack?: ModalStackManager;
}

const MISMATCH_MODAL_ID = 'manifest-mismatch';

/**
 * Asks before importing a save made with another pack's rules: non-destructive, in the
 * one dialog frame. It sits on the crash layer, above the save-code window it can open
 * from, and on `modalStack` when given one.
 */
export function showManifestMismatchDialog(options: ManifestMismatchDialogOptions): void {
  const { detectedManifestId, activeGameName, heroName, onConfirm, onCancel, modalStack } = options;

  const scrim = createDialogScrim('manifest-mismatch-modal', 'crash');
  if (!scrim) return;
  scrim.innerHTML = dialogHtml({
    title: 'A save from another game',
    kicker: 'Import',
    icon: 'warning',
    size: 'narrow',
    body: `
      <div class="ui-dialog-lede"><b>${escapeHtml(heroName)}</b> comes from another game (its save says “${escapeHtml(detectedManifestId)}”), not <b>${escapeHtml(activeGameName)}</b>.</div>
      <div class="ui-fact is-warn">The hero may arrive with abilities this game doesn't know, items without art, and different balance.</div>`,
    actions: dialogButton('btn-mismatch-cancel', 'Cancel') + dialogButton('btn-mismatch-import', 'Import anyway', { primary: true }),
  });
  scrim.style.display = 'flex';

  // Settles once, however the dialog closes: a button, or the stack's Escape.
  let settled = false;
  const settle = (confirmed: boolean) => {
    if (settled) return;
    settled = true;
    scrim.style.display = 'none';
    modalStack?.remove(MISMATCH_MODAL_ID);
    if (confirmed) onConfirm();
    else onCancel?.();
  };
  scrim.querySelector('#btn-mismatch-cancel')?.addEventListener('click', () => settle(false));
  scrim.querySelector('#btn-mismatch-import')?.addEventListener('click', () => settle(true));
  modalStack?.push({
    id: MISMATCH_MODAL_ID,
    isOpen: false,
    // Unhandled: the stack traps every key, and closes the dialog (cancels) on Escape.
    handleKeyDown: () => false,
    close: () => settle(false),
  });
}

/**
 * Validates, checks manifest compatibility, and imports a save payload into ProfileManager.
 */
export function importSaveWithValidation(options: {
  content: string;
  filename?: string;
  profileManager: ProfileManager;
  activeManifestId: string;
  onSuccess: (profile: CharacterProfile) => void;
  onError: (errorMessage: string) => void;
  /** The player turned down another pack's save; without this, `onError` hears of it. */
  onCancel?: () => void;
  modalStack?: ModalStackManager;
}): void {
  const { content, profileManager, activeManifestId, onSuccess, onError, onCancel, modalStack } = options;

  const validation: SaveValidationResult = validateSavePayload(content, {
    expectedManifestId: activeManifestId,
  });

  if (!validation.valid || !validation.envelope) {
    onError(validation.error || 'Invalid save file format.');
    return;
  }

  const executeImport = () => {
    try {
      const imported = profileManager.importHero(content);
      onSuccess(imported);
    } catch (err) {
      onError((err as Error).message);
    }
  };

  if (validation.manifestMismatch && validation.detectedManifestId) {
    showManifestMismatchDialog({
      detectedManifestId: validation.detectedManifestId,
      activeGameName: profileManager.manifest?.name ?? activeManifestId,
      heroName: validation.envelope.data.profile.name,
      onConfirm: executeImport,
      onCancel: onCancel ?? (() => onError('the save is from another game, so nothing was imported.')),
      modalStack,
    });
  } else {
    executeImport();
  }
}
