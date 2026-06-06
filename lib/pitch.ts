// Pitch detection algorithm based on normalized autocorrelation

export interface DetectionResult {
  frequency: number;
  confidence: number;
  noteName: string;
  octave: number;
  cents: number;
  noteIndex: number;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function autoCorrelate(buffer: Float32Array, sampleRate: number): { frequency: number; confidence: number } {
  const size = buffer.length;
  
  // Compute Root Mean Square (RMS) to ignore noise
  let rms = 0;
  for (let i = 0; i < size; i++) {
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / size);
  if (rms < 0.008) {
    return { frequency: -1, confidence: 0 }; // Too quiet
  }

  // Range limit: Vocal ranges typically lie between 80Hz and 1000Hz
  const maxFreq = 1000;
  const minFreq = 80;
  const minPeriod = Math.floor(sampleRate / maxFreq); // e.g., 44 samples at 44.1kHz
  const maxPeriod = Math.ceil(sampleRate / minFreq);  // e.g., 551 samples at 44.1kHz

  const r = new Float32Array(maxPeriod + 2);
  
  // Calculate autocorrelation for different sample shifts (lags)
  for (let lag = minPeriod; lag <= maxPeriod; lag++) {
    let sum = 0;
    let sumSqrY = 0;
    let sumSqrY_lag = 0;
    const len = size - lag;
    
    for (let i = 0; i < len; i++) {
      const y = buffer[i];
      const y_lag = buffer[i + lag];
      sum += y * y_lag;
      sumSqrY += y * y;
      sumSqrY_lag += y_lag * y_lag;
    }
    
    const norm = Math.sqrt(sumSqrY * sumSqrY_lag);
    r[lag] = norm > 0 ? sum / norm : 0;
  }

  // Search for local maximum peaks
  let peakLag = -1;
  let maxCorrelation = -1;

  for (let lag = minPeriod; lag <= maxPeriod; lag++) {
    if (r[lag] > r[lag - 1] && r[lag] > r[lag + 1]) {
      if (r[lag] > maxCorrelation && r[lag] > 0.65) {
        maxCorrelation = r[lag];
        peakLag = lag;
      }
    }
  }

  // Refine peak with parabolic interpolation
  if (peakLag !== -1) {
    let T0 = peakLag;
    const s1 = r[peakLag - 1];
    const s2 = r[peakLag];
    const s3 = r[peakLag + 1];
    const denom = s1 + s3 - 2 * s2;
    if (Math.abs(denom) > 1e-5) {
      const delta = (s1 - s3) / (2 * denom);
      T0 = peakLag + delta;
    }
    
    const freq = sampleRate / T0;
    if (freq >= minFreq && freq <= maxFreq) {
      return { frequency: freq, confidence: maxCorrelation };
    }
  }

  return { frequency: -1, confidence: 0 };
}

export function frequencyToNote(frequency: number): DetectionResult | null {
  if (frequency <= 0 || isNaN(frequency)) return null;

  // A4 = 440 Hz is MIDI note 69
  // noteNumber = 12 * log2(frequency / 440) + 69
  const noteNum = 12 * Math.log2(frequency / 440) + 69;
  const rounded = Math.round(noteNum);
  const cents = Math.round((noteNum - rounded) * 100);

  const octave = Math.floor(rounded / 12) - 1;
  const noteIndex = ((rounded % 12) + 12) % 12;
  const noteName = NOTE_NAMES[noteIndex];

  return {
    frequency,
    confidence: 1, // Will be set by client
    noteName,
    octave,
    cents,
    noteIndex,
  };
}
