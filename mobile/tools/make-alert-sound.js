/**
 * make-alert-sound.js — generates assets/sounds/alert.wav (a two-tone alert chime).
 * Owner: Person 3/4 (Zuhayr). Run once: `node tools/make-alert-sound.js`
 * Why generate it: no downloaded audio files, so there are no licence questions and nothing untrusted.
 */
const fs = require('fs');
const path = require('path');

const RATE = 22050; // samples per second — plenty for a beep, keeps the file small

/**
 * Builds one tone as 16-bit samples with a short fade in/out (avoids clicking).
 * Inputs: freq in Hz, seconds. Output: array of integer samples.
 */
function tone(freq, seconds) {
  const n = Math.floor(RATE * seconds);
  const out = [];
  for (let i = 0; i < n; i++) {
    const fade = Math.min(1, i / 400, (n - i) / 400);
    out.push(Math.round(Math.sin((2 * Math.PI * freq * i) / RATE) * 0.6 * fade * 32767));
  }
  return out;
}

/** Silence of the given length in seconds. */
const gap = (s) => new Array(Math.floor(RATE * s)).fill(0);

// High–low–high–low: sounds "urgent" without being a harsh siren.
const samples = [
  ...tone(988, 0.18), ...gap(0.05), ...tone(740, 0.18), ...gap(0.12),
  ...tone(988, 0.18), ...gap(0.05), ...tone(740, 0.18),
];

// Standard 44-byte WAV header for mono 16-bit PCM.
const data = Buffer.alloc(samples.length * 2);
samples.forEach((s, i) => data.writeInt16LE(s, i * 2));
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

const outDir = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'alert.wav'), Buffer.concat([header, data]));
console.log('Wrote assets/sounds/alert.wav');
