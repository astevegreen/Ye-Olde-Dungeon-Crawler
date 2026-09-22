import type { GameEngine } from '../../engine';
import { TrainerService } from '../../engine';
import type { ShopPanelBounds, ShopPanelContext } from './types';

/** Callbacks renderTrainerServices needs from the owning ShopOverlay. */
export interface TrainerServicesActions {
  bondCompanion(): void;
  reviveCompanion(): void;
  switchArchetype: (a:'bodyguard'|'skirmisher')=>void;
  teachRallyHowl(): void;
}

export function renderTrainerServices(
  ctx: CanvasRenderingContext2D,
  engine: GameEngine,
  bounds: ShopPanelBounds,
  panel: ShopPanelContext,
  actions: TrainerServicesActions
): void {
  const { modalX, modalW, startY } = bounds;
    const boxW = modalW - 24;
    const boxX = modalX + 12;
    const theme = panel.theme;
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';
    const boxH = 200;

    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(boxX, startY, boxW, boxH);
    ctx.strokeStyle = theme.cardBorder;
    ctx.strokeRect(boxX + 0.5, startY + 0.5, boxW - 1, boxH - 1);

    ctx.font = `bold 13px ${font}`;
    ctx.fillStyle = '#facc15';
    ctx.textAlign = 'left';
    ctx.fillText('COMPANION TRAINING', boxX + 14, startY + 22);

    const companion = engine.companion;
    const bonded = engine.getWorldFlag('companion_bonded');
    ctx.font = `11px ${font}`;
    ctx.fillStyle = theme.hudText;
    const statusLine = !bonded
      ? 'You have not yet bonded with a companion.'
      : companion
      ? `${companion.name} (${companion.archetype}) — HP ${companion.hp}/${companion.maxHp}`
      : engine.deadCompanionRecord
      ? `${engine.deadCompanionRecord.name} has fallen and awaits revival.`
      : 'Bonded, but no companion is currently summoned.';
    ctx.fillText(statusLine, boxX + 14, startY + 40);

    const rows: Array<{ label: string; key: string }> = [
      { label: `[T] Bond with a Companion (${(TrainerService.BOND_COST_CP / 100).toFixed(0)} GP)`, key: 't' },
      { label: `[R] Revive Fallen Companion (${(TrainerService.REVIVE_COST_CP / 100).toFixed(0)} GP)`, key: 'r' },
      { label: `[G] Train as Bodyguard (${(TrainerService.ARCHETYPE_SWITCH_COST_CP / 100).toFixed(0)} GP)`, key: 'g' },
      { label: `[K] Train as Skirmisher (${(TrainerService.ARCHETYPE_SWITCH_COST_CP / 100).toFixed(0)} GP)`, key: 'k' },
      { label: `[W] Teach Rally Howl (${(TrainerService.TEACH_SKILL_COST_CP / 100).toFixed(0)} GP)`, key: 'w' },
    ];

    ctx.font = `11px ${font}`;
    ctx.fillStyle = theme.hudAccent;
    let rowY = startY + 62;
    for (const row of rows) {
      ctx.fillText(row.label, boxX + 14, rowY);
      panel.addClickZone({
        x: boxX + 10,
        y: rowY - 14,
        width: boxW - 20,
        height: 18,
        action: () => {
          if (row.key === 't') actions.bondCompanion();
          else if (row.key === 'r') actions.reviveCompanion();
          else if (row.key === 'g') actions.switchArchetype('bodyguard');
          else if (row.key === 'k') actions.switchArchetype('skirmisher');
          else if (row.key === 'w') actions.teachRallyHowl();
        },
      });
      rowY += 22;
    }
}
