/**
 * Reusable curved-path primitives for organic sprite shapes (creatures, foliage).
 * Opt-in helpers for recipe authors — not wired into any existing recipe by this
 * module. Existing straight-line/arc recipes are untouched; new or updated recipes
 * can reach for these instead of building organic silhouettes out of rects.
 */

/** A tapered, gently curved limb/tail: wide at (x0,y0), narrowing to (x1,y1). */
export function drawTaperedTail(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width0: number,
  width1: number
): void {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular offset, bowed outward slightly for a natural curve rather than a wedge.
  const nx = (-dy / len) * (width0 * 0.5);
  const ny = (dx / len) * (width0 * 0.5);

  ctx.beginPath();
  ctx.moveTo(x0 + nx, y0 + ny);
  ctx.quadraticCurveTo(mx + nx * 0.5, my + ny * 0.5, x1 + (width1 / width0) * nx * 0.3, y1 + (width1 / width0) * ny * 0.3);
  ctx.lineTo(x1 - (width1 / width0) * nx * 0.3, y1 - (width1 / width0) * ny * 0.3);
  ctx.quadraticCurveTo(mx - nx * 0.5, my - ny * 0.5, x0 - nx, y0 - ny);
  ctx.closePath();
  ctx.fill();
}

/** An organic, slightly irregular blob silhouette (a body/torso mass) instead of a hard ellipse. */
export function drawOrganicBlob(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  wobble = 0.15
): void {
  const points = 8;
  const angleStep = (Math.PI * 2) / points;
  const radii: number[] = [];
  for (let i = 0; i < points; i++) {
    const wobbleFactor = 1 + Math.sin(i * 2.399) * wobble; // deterministic, not random — stable bake output
    radii.push(wobbleFactor);
  }

  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const angle = i * angleStep;
    const r = radii[i % points];
    const x = cx + Math.cos(angle) * rx * r;
    const y = cy + Math.sin(angle) * ry * r;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      const prevAngle = (i - 1) * angleStep;
      const prevR = radii[(i - 1) % points];
      const cxp = cx + Math.cos(prevAngle + angleStep / 2) * rx * ((r + prevR) / 2) * 1.08;
      const cyp = cy + Math.sin(prevAngle + angleStep / 2) * ry * ((r + prevR) / 2) * 1.08;
      ctx.quadraticCurveTo(cxp, cyp, x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
}

/** A smoothly rounded limb (arm/leg/horn) between two joints, wider at the base. */
export function drawRoundedLimb(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (width * 0.5);
  const ny = (dx / len) * (width * 0.5);

  ctx.beginPath();
  ctx.moveTo(x0 + nx, y0 + ny);
  ctx.lineTo(x1 + nx * 0.4, y1 + ny * 0.4);
  ctx.arc(x1, y1, width * 0.4, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
  ctx.lineTo(x0 - nx, y0 - ny);
  ctx.arc(x0, y0, width * 0.5, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
  ctx.closePath();
  ctx.fill();
}
