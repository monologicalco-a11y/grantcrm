// Simple ringtone generator - creates an actual audible tone
// Save this as ringtone.js and run with: node ringtone.js

import * as fs from 'fs';

// WAV file parameters
const sampleRate = 8000;
const duration = 2; // seconds
const numSamples = sampleRate * duration;

// Create WAV header
function createWavHeader(dataSize) {
    const buffer = Buffer.alloc(44);

    // "RIFF" chunk descriptor
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);

    // "fmt " sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size
    buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
    buffer.writeUInt16LE(1, 22); // NumChannels (1 = mono)
    buffer.writeUInt32LE(sampleRate, 24); // SampleRate
    buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
    buffer.writeUInt16LE(2, 32); // BlockAlign
    buffer.writeUInt16LE(16, 34); // BitsPerSample

    // "data" sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    return buffer;
}

// Generate UK dual-tone ringtone (400Hz + 450Hz)
function generateRingtone() {
    const samples = Buffer.alloc(numSamples * 2); // 16-bit samples

    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        let value = 0;

        // Create ring pattern: 0.4s on, 0.2s off, 0.4s on, 1.0s silence
        const phase = t % 2; // 2 second cycle

        if (phase < 0.4 || (phase >= 0.6 && phase < 1.0)) {
            // Generate dual tone (UK standard)
            const tone1 = Math.sin(2 * Math.PI * 400 * t);
            const tone2 = Math.sin(2 * Math.PI * 450 * t);
            value = (tone1 + tone2) * 0.3; // Mix and reduce volume

            // Apply envelope for smooth attack/decay
            const ringPhase = (phase < 0.4) ? phase : (phase - 0.6);
            const envelope = Math.min(ringPhase * 10, 1) * Math.min((0.4 - ringPhase) * 10, 1);
            value *= envelope;
        }

        // Convert to 16-bit PCM
        const pcmValue = Math.max(-32768, Math.min(32767, Math.round(value * 32767)));
        samples.writeInt16LE(pcmValue, i * 2);
    }

    return samples;
}

// Generate and save the ringtone
const audioData = generateRingtone();
const header = createWavHeader(audioData.length);
const wavFile = Buffer.concat([header, audioData]);

fs.writeFileSync('public/ringtone.wav', wavFile);
console.log('✅ Ringtone generated: public/ringtone.wav');
console.log(`📊 File size: ${wavFile.length} bytes`);
console.log(`⏱️  Duration: ${duration} seconds`);
