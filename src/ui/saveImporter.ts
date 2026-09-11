import { validateSavePayload, type SaveValidationResult } from '../engine/storage/saveTransfer';
import type { ProfileManager } from '../engine/storage/profile-manager';
import type { CharacterProfile } from '../engine/storage/types';

/**
 * Triggers a browser file download of text content (e.g. .cotw save files).
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

/**
 * Opens the native browser file picker dialog for save files.
 */
export function openFilePicker(
  callback: (content: string, filename: string) => void,
  accept = '.cotw,.sav,.json'
): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.style.display = 'none';

  input.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      callback(content, file.name);
    };
    reader.readAsText(file);
  });

  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
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
        <div style="font-size: 36px; margin-bottom: 8px;">📥</div>
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 4px;">DROP SAVE FILE HERE</div>
        <div style="font-size: 12px; color: #94a3b8;">Restores .cotw, .sav, or .json adventurer</div>
      </div>
    `;
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.backgroundColor = 'rgba(10, 15, 30, 0.88)';
    overlay.style.backdropFilter = 'blur(4px)';
    overlay.style.display = 'none';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '250';
    overlay.style.pointerEvents = 'none';

    container.style.position = 'relative';
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
  activeManifestId: string;
  heroName: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

/**
 * Displays a non-destructive warning dialog when an imported save was created
 * with a different manifest (e.g. Warcraft vs CotW).
 */
export function showManifestMismatchDialog(options: ManifestMismatchDialogOptions): void {
  const { detectedManifestId, activeManifestId, heroName, onConfirm, onCancel } = options;

  let existingModal = document.getElementById('manifest-mismatch-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'manifest-mismatch-modal';
  modal.className = 'retro-window-overlay';
  modal.style.zIndex = '300';
  modal.style.display = 'flex';

  modal.innerHTML = `
    <div class="retro-window" style="width: 480px; max-width: 90vw;">
      <div class="retro-titlebar" style="background: linear-gradient(90deg, #9a3412, #ea580c);">
        <div class="retro-titlebar-title">
          <span>⚠️</span>
          <span>Manifest Compatibility Warning</span>
        </div>
      </div>
      <div class="retro-window-body" style="padding: 12px;">
        <div style="font-size: 13px; font-weight: bold; margin-bottom: 8px; color: #9a3412;">
          Cross-Theme Save Detected
        </div>
        <p style="font-size: 12px; margin-bottom: 8px; line-height: 1.4;">
          The save file for <b>${heroName}</b> was created under the <b>${detectedManifestId}</b> game rules,
          but your active session is running <b>${activeManifestId}</b>.
        </p>
        <p style="font-size: 11px; color: #4b5563; margin-bottom: 14px; background: #fef3c7; padding: 6px; border: 1px solid #f59e0b;">
          Importing across different game themes may cause unfamiliar abilities, missing item graphics, or altered balance.
        </p>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button id="btn-mismatch-cancel" class="win-btn" style="padding: 4px 12px;">Cancel</button>
          <button id="btn-mismatch-import" class="win-btn primary-btn" style="padding: 4px 12px; font-weight: bold;">Import Anyway</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const cleanup = () => {
    modal.remove();
  };

  modal.querySelector('#btn-mismatch-cancel')?.addEventListener('click', () => {
    cleanup();
    if (onCancel) onCancel();
  });

  modal.querySelector('#btn-mismatch-import')?.addEventListener('click', () => {
    cleanup();
    onConfirm();
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
}): void {
  const { content, profileManager, activeManifestId, onSuccess, onError } = options;

  const validation: SaveValidationResult = validateSavePayload(content, {
    expectedManifestId: activeManifestId,
    allowLegacyManifestAlias: profileManager.manifest?.supportsLegacyKeys === true,
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
      activeManifestId,
      heroName: validation.envelope.data.profile.name,
      onConfirm: executeImport,
      onCancel: () => {
        onError('Import cancelled by user due to manifest mismatch.');
      },
    });
  } else {
    executeImport();
  }
}
