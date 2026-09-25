import { describe, expect, it } from 'vitest';
import { ProfileManager, MemoryStorage, WaitAction, flightRecorder, loadReplayState, replayActionTrail } from '../../engine';
import { cotwManifest } from '../../content/cotw';
import { encodeReplayBlock, expandCompressedReplay } from '../replayCodec';

describe('replay codec', () => {
  it('round-trips replay data through a ```replay-gz block that loadReplayState can then read', async () => {
    const pm = new ProfileManager(new MemoryStorage(), cotwManifest);
    const { engine } = pm.createCharacter('Codec', { manifest: cotwManifest });
    engine.changeFloor(2);
    for (let i = 0; i < 5; i++) engine.handlePlayerAction(new WaitAction(engine.player));
    const replay = flightRecorder.getReplayData();
    const json = JSON.stringify(replay);

    const block = await encodeReplayBlock(json);
    expect(block.length).toBeLessThan(json.length / 3);

    const pasted = `# Report\n\n## 5. Replay Data\n\`\`\`replay-gz\n${block}\n\`\`\`\n`;
    const expanded = await expandCompressedReplay(pasted);
    expect(expanded).not.toContain('replay-gz');

    const loaded = loadReplayState(expanded, cotwManifest);
    if (!loaded.ok) throw new Error(loaded.message);
    expect(replayActionTrail(loaded.value.engine, loaded.value.trail)).toEqual({ replayed: 5, total: 5 });
    expect(loaded.value.engine.turnCount).toBe(engine.turnCount);
  });

  it('leaves text without a compressed block unchanged', async () => {
    expect(await expandCompressedReplay('plain text')).toBe('plain text');
  });
});
