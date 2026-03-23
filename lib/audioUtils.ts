// lib/audioUtils.ts

/**
 * Surgically slices an audio Blob from a start time to an end time.
 * @param {Blob} originalBlob - The raw microphone recording
 * @param {number} startSec - The start time in seconds
 * @param {number} endSec - The end time in seconds
 * @returns {Promise<Blob>} - The newly trimmed audio Blob (WAV format)
 */
export async function trimAudioBlob(originalBlob: Blob, startSec: number, endSec: number): Promise<Blob> {
  // 1. Initialize an Offline Audio Context
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // 2. Decode the raw Blob into an AudioBuffer
  const arrayBuffer = await originalBlob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // 3. Calculate exact frame indices based on the sample rate
  const sampleRate = audioBuffer.sampleRate;
  const startOffset = Math.floor(startSec * sampleRate);
  const endOffset = Math.floor(endSec * sampleRate);
  const frameCount = endOffset - startOffset;

  // 4. Create a new, blank AudioBuffer for the trimmed section
  const trimmedBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    frameCount,
    sampleRate
  );

  // 5. Copy the audio data channel by channel
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    const trimmedData = trimmedBuffer.getChannelData(channel);
    
    // Copy the exact slice from the original into the new buffer
    for (let i = 0; i < frameCount; i++) {
      trimmedData[i] = channelData[startOffset + i];
    }
  }

  // 6. Convert the trimmed AudioBuffer back into a WAV Blob
  return audioBufferToWavBlob(trimmedBuffer);
}

/**
 * Helper function to package an AudioBuffer into a playable .WAV Blob
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new ArrayBuffer(length);
  const view = new DataView(out);
  const channels = [];
  let sample = 0;
  let offset = 0;
  let pos = 0;

  // Write WAV Header
  const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
  const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };
  
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit
  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // Write interleaved audio data
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      // Interleave channels and clamp values to 16-bit PCM
      sample = Math.max(-1, Math.min(1, channels[i][offset])); 
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([view], { type: "audio/wav" });
}