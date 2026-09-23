/**
 * Pemotongan audio sisi klien (Web Audio API) tanpa backend baru.
 * Hasilnya adalah file WAV valid yang diunggah lewat uploader media existing.
 */

/** Batas aman agar perangkat Android kelas menengah tidak kehabisan memori. */
export const TRIM_MAX_SOURCE_BYTES = 25 * 1024 * 1024; // 25 MB
export const TRIM_MAX_SOURCE_SECONDS = 20 * 60; // 20 menit

export class AudioTrimError extends Error {}

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** True bila perangkat ini mendukung pemotongan audio sisi klien. */
export function canTrimAudio(): boolean {
  return getAudioContextCtor() !== null;
}

/** Encode AudioBuffer (potongan) menjadi WAV PCM 16-bit. */
function encodeWav(buffer: AudioBuffer, startSample: number, endSample: number): Blob {
  const channels = buffer.numberOfChannels;
  const frames = Math.max(0, endSample - startSample);
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataSize, true);

  const data: Float32Array[] = [];
  for (let channel = 0; channel < channels; channel += 1) data.push(buffer.getChannelData(channel));

  let offset = 44;
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = data[channel]?.[startSample + frame] ?? 0;
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/** Nama file hasil trim, selalu berekstensi .wav. */
export function trimmedFileName(sourceName: string): string {
  const base = sourceName.replace(/\.[^.]+$/, "") || "audio";
  return `${base}-trim.wav`;
}

/**
 * Potong audio dari Blob/File sumber pada rentang detik [start, end).
 * Melempar AudioTrimError dengan pesan Bahasa Indonesia yang jelas bila gagal.
 */
export async function trimAudioBlob(
  source: Blob,
  start: number,
  end: number,
  fileName: string,
): Promise<File> {
  const Ctor = getAudioContextCtor();
  if (!Ctor) {
    throw new AudioTrimError("Perangkat ini tidak mendukung pemotongan audio.");
  }
  if (source.size > TRIM_MAX_SOURCE_BYTES) {
    throw new AudioTrimError("Berkas audio terlalu besar untuk dipotong di perangkat ini.");
  }
  if (!(start >= 0) || !(end > start)) {
    throw new AudioTrimError("Rentang potongan tidak valid.");
  }

  const context = new Ctor();
  try {
    const arrayBuffer = await source.arrayBuffer();
    let decoded: AudioBuffer;
    try {
      decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    } catch {
      throw new AudioTrimError("Format audio ini tidak dapat dipotong di perangkat ini.");
    }
    if (decoded.duration > TRIM_MAX_SOURCE_SECONDS) {
      throw new AudioTrimError("Durasi audio terlalu panjang untuk dipotong di perangkat ini.");
    }

    const safeEnd = Math.min(end, decoded.duration);
    const startSample = Math.floor(start * decoded.sampleRate);
    const endSample = Math.floor(safeEnd * decoded.sampleRate);
    if (endSample <= startSample) {
      throw new AudioTrimError("Rentang potongan tidak valid.");
    }

    const blob = encodeWav(decoded, startSample, endSample);
    return new File([blob], trimmedFileName(fileName), { type: "audio/wav" });
  } finally {
    void context.close().catch(() => undefined);
  }
}

/** Format waktu MM:SS.d untuk tampilan presisi 0,1 detik. */
export function formatPreciseTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00.0";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(minutes)}:${pad(Math.floor(rest))}.${Math.floor((rest % 1) * 10)}`;
}
