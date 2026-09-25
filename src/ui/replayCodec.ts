/**
 * Compact encoding for a bug report's replay data, so it fits in a pasted GitHub issue
 * (65,536-character body limit). The block is gzip + base64 inside a ```replay-gz fence;
 * `expandCompressedReplay` turns it back into a ```json block that `loadReplayState`
 * reads, and scripts/replay-report.ts decodes the same format with node:zlib.
 */
const BLOCK = /```replay-gz\s*\n([\s\S]*?)\n```/g;

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** gzip + base64 of `json`, wrapped at 76 columns so it pastes cleanly. */
export async function encodeReplayBlock(json: string): Promise<string> {
  const gz = await pipe(new TextEncoder().encode(json), new CompressionStream('gzip'));
  return toBase64(gz).replace(/(.{76})/g, '$1\n');
}

/** Replaces each ```replay-gz block in `text` with the ```json block it encodes. */
export async function expandCompressedReplay(text: string): Promise<string> {
  const matches = [...text.matchAll(BLOCK)];
  let result = text;
  for (const m of matches) {
    const bytes = Uint8Array.from(atob(m[1].replace(/\s+/g, '')), (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(await pipe(bytes, new DecompressionStream('gzip')));
    result = result.replace(m[0], '```json\n' + json + '\n```');
  }
  return result;
}
