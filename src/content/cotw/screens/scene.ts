import type { ScreenBox, ScreenScene } from '../../../engine';
import { Buf, LOOP } from './paint';

/**
 * A painting's buffer for one viewport: `s` CSS pixels to a buffer pixel, `IW` by `IH` buffer
 * pixels (about 256-300 rows), and `u` buffer pixels to a design unit (the scene is 256 units
 * tall and laid out from its right edge, so a wider window shows more on the left).
 */
export interface Scene {
  s: number;
  IW: number;
  IH: number;
  u: number;
  frame: Buf;
}

/** x, y, w, h in buffer pixels. */
export type Box = [number, number, number, number];

/** Where the lettering sits and the quiet region left for the menu or dialog. */
export interface Boxes {
  text: Box;
  calm: Box;
}

const scaleFor = (h: number): number => Math.max(1, Math.ceil(h / 300));

/** A painted screen: built once per viewport, painted per frame into the same buffer. */
export function screen<S extends Scene>(build: (base: Scene) => S, paint: (sc: S, t: number) => void, boxes: (IW: number, IH: number) => Boxes): ScreenScene {
  return {
    loopMs: LOOP,
    open(w, h) {
      const s = scaleFor(h), IW = Math.ceil(w / s), IH = Math.ceil(h / s);
      const sc = build({ s, IW, IH, u: IH / 256, frame: new Buf(IW, IH) });
      const rgba = new Uint8ClampedArray(sc.frame.px.buffer);
      const box = ([x, y, bw, bh]: Box): ScreenBox => ({ x: Math.round(x * s), y: Math.round(y * s), w: Math.round(bw * s), h: Math.round(bh * s) });
      const b = boxes(IW, IH);
      return {
        width: IW,
        height: IH,
        scale: s,
        text: box(b.text),
        calm: box(b.calm),
        paint(t) {
          paint(sc, ((t % LOOP) + LOOP) % LOOP);
          return rgba;
        },
      };
    },
  };
}
