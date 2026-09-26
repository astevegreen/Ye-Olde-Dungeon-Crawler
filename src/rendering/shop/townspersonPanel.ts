import type { GameEngine } from '../../engine';
import type { NPC } from '../../engine';
import { findRuneOfReturn } from '../../engine';
import type { ShopPanelBounds, ShopPanelContext } from './types';

/** Callbacks renderTownspersonDialog needs from the owning ShopOverlay. */
export interface TownspersonDialogActions {
  close(): void;
  openRuneTree?(): void;
}

export function renderTownspersonDialog(
  ctx: CanvasRenderingContext2D,
  _engine: GameEngine,
  bounds: ShopPanelBounds,
  data: { activeNpc: NPC | null },
  panel: ShopPanelContext,
  actions: TownspersonDialogActions
): void {
  const { modalX, modalW, startY } = bounds;
    const boxW = modalW - 24;
    const boxX = modalX + 12;
    const theme = panel.theme;
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    const attunementNpcId = _engine.manifest?.runeOfReturn?.attunementNpcId;
    if (attunementNpcId && data.activeNpc?.id === attunementNpcId) {
      const rune = findRuneOfReturn(_engine.player);
      const boxH = 140;
      ctx.fillStyle = theme.cardBg;
      ctx.fillRect(boxX, startY, boxW, boxH);
      ctx.strokeStyle = theme.cardBorder;
      ctx.strokeRect(boxX + 0.5, startY + 0.5, boxW - 1, boxH - 1);

      ctx.font = `bold 13px ${font}`;
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'left';
      ctx.fillText('RUNE-SMITH FORGE & ATTUNEMENT', boxX + 14, startY + 24);

      ctx.font = `11px ${font}`;
      const isAwakened = Boolean(_engine.player?.hasDiscoveredRune);
      if (rune && isAwakened) {
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`Rune of Return: ${rune.charges}/${rune.maxCharges} Charges (Innate Spirit Power)`, boxX + 14, startY + 48);
        ctx.fillStyle = '#a3e635';
        if (_engine.player?.deepestRecallFloor) {
          ctx.fillText(`Return Rift Active: Floor ${_engine.player.deepestRecallFloor} (Press [T] in town to return)`, boxX + 14, startY + 68);
        } else {
          ctx.fillText('Attuned and ready for recall channeling in the dungeon depths.', boxX + 14, startY + 68);
        }
      } else if (rune && !isAwakened) {
        ctx.fillStyle = '#fde047';
        ctx.fillText('Dormant Rune Carried: Speak with Thrain to awaken its secrets.', boxX + 14, startY + 48);
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('Thrain will teach you the incantations to bind its recall magic to your spirit.', boxX + 14, startY + 68);
      } else {
        ctx.fillStyle = '#f87171';
        ctx.fillText('You have not yet discovered the Rune of Return.', boxX + 14, startY + 48);
        ctx.fillStyle = theme.hudText;
        ctx.fillText('Thrain speaks of an ancient ice vault on Floor 5 guarded by Gálmr the Frost-Warden.', boxX + 14, startY + 68);
      }

      // Upgrade tree button
      const btnY = startY + 92;
      const btnH = 28;
      ctx.fillStyle = theme.modalTitlebar;
      ctx.fillRect(boxX + 14, btnY, boxW - 28, btnH);
      ctx.strokeStyle = isAwakened ? '#38bdf8' : '#475569';
      ctx.strokeRect(boxX + 14.5, btnY + 0.5, boxW - 29, btnH - 1);

      ctx.font = `bold 12px ${font}`;
      ctx.fillStyle = isAwakened ? '#38bdf8' : '#64748b';
      ctx.textAlign = 'center';
      ctx.fillText(
        isAwakened ? '⚡ [U] Open Rune of Return Mastery Tree' : '🔒 Rune Mastery Locked (Awaken Rune with Thrain)',
        boxX + boxW / 2,
        btnY + 18
      );
      ctx.textAlign = 'left';

      if (isAwakened) {
        panel.addClickZone({
          x: boxX + 14,
          y: btnY,
          width: boxW - 28,
          height: btnH,
          action: () => {
            if (actions.openRuneTree) {
              actions.close();
              actions.openRuneTree();
            }
          },
        });
      }
      return;
    }

    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(boxX, startY, boxW, 140);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(boxX + 0.5, startY + 0.5, boxW - 1, 139);

    ctx.font = `bold 13px ${font}`;
    ctx.fillStyle = theme.hudAccent;
    ctx.textAlign = 'left';
    ctx.fillText("TOWN ADVICE & LOCAL LORE", boxX + 14, startY + 24);

    ctx.font = `12px ${font}`;
    ctx.fillStyle = theme.hudText;
    const townName = _engine.manifest?.town?.name ?? 'The town';
    ctx.fillText(`${townName} is peaceful, but the cellar entrance north-east holds`, boxX + 14, startY + 50);
    ctx.fillText("terrors from old myths. Make sure you purchase torches and", boxX + 14, startY + 70);
    ctx.fillText("sturdy armor before you venture down.", boxX + 14, startY + 90);
}
