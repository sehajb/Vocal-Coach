"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Mic, 
  MicOff, 
  Music, 
  Sparkles, 
  RotateCcw, 
  HelpCircle, 
  ChevronRight, 
  BookOpen, 
  Layers, 
  Smile, 
  Flame,
  Info,
  Activity,
  Award,
  WifiOff
} from "lucide-react";
import { autoCorrelate, frequencyToNote, DetectionResult } from "@/lib/pitch";
import { 
  NOTE_NAMES, 
  CHORD_SHAPES, 
  buildChordsForKey, 
  getCapoSuggestions, 
  formatFlatName,
  ProgressionInfo,
  CapoOption
} from "@/lib/chords";

function getScaleNotes(keyIdx: number, isMajor: boolean): number[] {
  const intervals = isMajor ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
  return intervals.map(interval => (keyIdx + interval) % 12);
}

// A single-note event in the rolling window for key estimation
interface NoteEvent {
  noteIndex: number;
  confidence: number;
  timestamp: number;
}

// Visual component to render a guitar chord diagram in SVG
function GuitarChordDiagram({ chordName }: { chordName: string }) {
  // Normalize flats to sharps for lookup
  const shape = CHORD_SHAPES[chordName];
  if (!shape) {
    return (
      <div className="w-28 h-36 flex flex-col items-center justify-center border border-dashed border-zinc-700 rounded-lg p-2 bg-zinc-900/60 font-mono text-xs text-zinc-500">
        <span>{chordName}</span>
        <span className="text-[10px] mt-1 text-center">Shape pending</span>
      </div>
    );
  }

  const { frets } = shape;
  const fretChars = frets.split(""); // e.g., ["x", "3", "2", "0", "1", "0"]
  
  // Parse fingers or fret numbers to find starting position
  const numericFrets = fretChars
    .map(c => parseInt(c))
    .filter(val => !isNaN(val) && val > 0);
  
  const maxFret = numericFrets.length > 0 ? Math.max(...numericFrets) : 0;
  const minFret = numericFrets.length > 0 ? Math.min(...numericFrets) : 1;
  
  // Capo or barre shift offset
  // If we play high chords (e.g. fret 5 or 6), start rendering from fret (min-1)
  const startFret = maxFret > 4 ? Math.max(1, minFret - 1) : 1;
  const displayFretsCount = 4; // Render 4 frets of space

  // Visual layout config
  const width = 110;
  const height = 135;
  const paddingLeft = 18;
  const paddingTop = 26;
  const FretSpacing = 22;
  const StringSpacing = 14;

  const getX = (stringIdx: number) => paddingLeft + stringIdx * StringSpacing;
  const getY = (fretIdx: number) => paddingTop + fretIdx * FretSpacing;

  return (
    <div className="flex flex-col items-center bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 shadow-lg hover:border-amber-500/50 transition-colors w-28 select-none">
      <div className="text-sm font-semibold text-zinc-100 truncate w-full text-center mb-1 font-sans">
        {formatFlatName(chordName)}
      </div>
      <svg width={width} height={height} className="overflow-visible" id={`chord-svg-${chordName}`}>
        {/* Draw starting fret label if shifted */}
        {startFret > 1 && (
          <text 
            x={2} 
            y={paddingTop + 14} 
            fontSize="10" 
            fill="#a1a1aa" 
            className="font-mono"
            textAnchor="start"
          >
            {startFret}fr
          </text>
        )}

        {/* Nut (fret 0 line) - draw thicker if we start at fret 1 */}
        <line 
          x1={getX(0)} 
          y1={paddingTop} 
          x2={getX(5)} 
          y2={paddingTop} 
          stroke={startFret === 1 ? "#fafafa" : "#71717a"} 
          strokeWidth={startFret === 1 ? "3" : "1"} 
        />

        {/* Frets (horizontal lines) */}
        {Array.from({ length: displayFretsCount }).map((_, fIdx) => {
          const y = getY(fIdx + 1);
          return (
            <line 
              key={fIdx} 
              x1={getX(0)} 
              y1={y} 
              x2={getX(5)} 
              y2={y} 
              stroke="#52525b" 
              strokeWidth="1" 
            />
          );
        })}

        {/* Strings (vertical lines) */}
        {Array.from({ length: 6 }).map((_, sIdx) => {
          const x = getX(sIdx);
          return (
            <line 
              key={sIdx} 
              x1={x} 
              y1={paddingTop} 
              x2={x} 
              y2={getY(displayFretsCount)} 
              stroke="#71717a" 
              strokeWidth={1 + (5 - sIdx) * 0.3} // Thicker bass strings
            />
          );
        })}

        {/* Mutes & Open string marks above the nut */}
        {fretChars.map((char, sIdx) => {
          const x = getX(sIdx);
          const y = paddingTop - 8;
          if (char === "x") {
            return (
              <g key={sIdx}>
                <line x1={x - 3} y1={y - 3} x2={x + 3} y2={y + 3} stroke="#ef4444" strokeWidth="1.5" />
                <line x1={x + 3} y1={y - 3} x2={x - 3} y2={y + 3} stroke="#ef4444" strokeWidth="1.5" />
              </g>
            );
          } else if (char === "0") {
            return (
              <circle 
                key={sIdx} 
                cx={x} 
                cy={y} 
                r="3" 
                fill="none" 
                stroke="#10b981" 
                strokeWidth="1.5" 
              />
            );
          }
          return null;
        })}

        {/* Finger Dots on frets */}
        {fretChars.map((char, sIdx) => {
          const fretNum = parseInt(char);
          if (isNaN(fretNum) || fretNum === 0) return null;

          // Compute rendered fret level offset
          const relativeFret = fretNum - startFret + 1;
          if (relativeFret < 1 || relativeFret > displayFretsCount) return null;

          // X is matching string, Y is center of the relative fret spacing
          const cx = getX(sIdx);
          const cy = getY(relativeFret) - FretSpacing / 2;

          return (
            <g key={sIdx}>
              <circle 
                cx={cx} 
                cy={cy} 
                r="6.5" 
                fill="#f59e0b" 
                className="shadow-md"
              />
              <text 
                x={cx} 
                y={cy + 3} 
                fill="#09090b" 
                fontSize="8" 
                fontWeight="bold" 
                textAnchor="middle" 
                className="font-sans"
              >
                {fretNum}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Interface for Gemini explanation response
interface TheoryExplanation {
  explanation: string;
  chordRoles: Array<{
    chord: string;
    role: string;
    explanation: string;
  }>;
  bollywoodConnections: string;
  practiceTips: string[];
}

// Generate high-fidelity deterministic offline theory tutorials when offline
function generateLocalOfflineTheory(key: string, isMajor: boolean): TheoryExplanation {
  const rootNote = key.split(" ")[0] || "C";
  const mode = isMajor ? "Major" : "Minor";
  const moodDescription = isMajor 
    ? "characterized by its bright, joyful, and emotionally resonant structure." 
    : "known for its soulful, introspective, and deeply melancholic quality.";
  
  return {
    explanation: `The key of ${key} is ${moodDescription} This key provides a fundamental baseline for your voice, helping you settle your pitch into centered vocal resonance. The scale notes are spaced beautifully across the vocal register.`,
    chordRoles: [
      { 
        chord: rootNote, 
        role: "Tonic (I / i)", 
        explanation: "The absolute home key and root chord of this scale. All vocal lines feel resolved here." 
      },
      { 
        chord: isMajor ? `${rootNote}m` : `${rootNote}`, 
        role: "Relative Chord", 
        explanation: "Adds contrast and harmonic richness to your singing lines." 
      }
    ],
    bollywoodConnections: isMajor 
      ? `Uplifting acoustic tracks and standard ghazals in ${rootNote} ${mode} let you rest on root tones easily.` 
      : `Soulful melodies, Sufi compositions, and emotional Bollywood classical crossover pieces are composed in ${rootNote} ${mode} to evoke deep devotion and longing.`,
    practiceTips: [
      `Arpeggio slides: Sing standard 1st to 5th to 8th scale degree jumps to stabilize chest voice alignment.`,
      `Resonant humming: Hum directly on the key frequency (${rootNote}) to practice head and throat register transitions.`,
      `Intonation drill: Record your voice centered on the Tonic note and check your cents meter for precision.`
    ]
  };
}

export default function Home() {
  // Audio state refs & variables
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const micStreamRef = React.useRef<MediaStream | null>(null);
  const animationIdRef = React.useRef<number | null>(null);

  // Connection State
  const [isOnline, setIsOnline] = React.useState<boolean>(true);

  React.useEffect(() => {
    // Read navigator safely inside asynchrony to satisfy the linter
    const timer = setTimeout(() => {
      if (typeof window !== "undefined") {
        setIsOnline(navigator.onLine);
      }
    }, 0);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Core functional states
  const [isListening, setIsListening] = React.useState(false);
  const [micError, setMicError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<"tuner" | "chords" | "range" | "theory">("tuner");
  
  // Vocal Range states
  const [rangeSessionActive, setRangeSessionActive] = React.useState(false);
  const rangeSessionActiveRef = React.useRef(false);
  const [rangeNotes, setRangeNotes] = React.useState<DetectionResult[]>([]);
  const [sessionReport, setSessionReport] = React.useState<any | null>(null);
  const [loadingRangeReport, setLoadingRangeReport] = React.useState(false);

  const toggleRangeSession = (active: boolean) => {
    setRangeSessionActive(active);
    rangeSessionActiveRef.current = active;
    if (active) {
      setRangeNotes([]);
      setSessionReport(null);
      if (!isListening) {
        startListeningSession();
      }
    }
  };

  // Realtime tuner state
  const [currentPitch, setCurrentPitch] = React.useState<DetectionResult | null>(null);
  const [recentFrequencies, setRecentFrequencies] = React.useState<number[]>([]);
  const [micRms, setMicRms] = React.useState<number>(0);

  // Key estimation variables
  const [noteEvents, setNoteEvents] = React.useState<NoteEvent[]>([]);

  // Compute key estimate whenever note events update via useMemo (avoids cascading render warnings)
  const estimatedKey = React.useMemo(() => {
    if (noteEvents.length < 8) {
      return null;
    }

    // Accumulate weights: count pitch classes weighted by duration or confidence
    const counts = new Array(12).fill(0);
    noteEvents.forEach((evt) => {
      counts[evt.noteIndex] += evt.confidence;
    });

    const sumObserved = counts.reduce((a, b) => a + b, 0);
    if (sumObserved === 0) return null;

    // Normalizing mean
    const meanObs = sumObserved / 12;

    // Krumhansl-Schmuckler profiles
    const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

    interface KeyScore {
      keyIndex: number;
      isMajor: boolean;
      name: string;
      correlation: number;
    }

    const keyScores: KeyScore[] = [];

    // Calculate correlation for all 24 keys (12 major + 12 minor)
    for (let isMajor = 0; isMajor <= 1; isMajor++) {
      const profile = isMajor === 1 ? MAJOR_PROFILE : MINOR_PROFILE;
      const meanProfile = profile.reduce((a, b) => a + b, 0) / 12;

      for (let keyIdx = 0; keyIdx < 12; keyIdx++) {
        let num = 0;
        let denObs = 0;
        let denProf = 0;

        for (let i = 0; i < 12; i++) {
          const profileValue = profile[(i - keyIdx + 12) % 12];
          const observedValue = counts[i];

          const diffObs = observedValue - meanObs;
          const diffProf = profileValue - meanProfile;

          num += diffObs * diffProf;
          denObs += diffObs * diffObs;
          denProf += diffProf * diffProf;
        }

        const correlation = denObs && denProf ? num / Math.sqrt(denObs * denProf) : 0;
        const keyName = NOTE_NAMES[keyIdx] + (isMajor === 1 ? " Major" : " Minor");

        keyScores.push({
          keyIndex: keyIdx,
          isMajor: isMajor === 1,
          name: keyName,
          correlation,
        });
      }
    }

    // Sort descending by highest correlation match
    keyScores.sort((a, b) => b.correlation - a.correlation);

    const primary = keyScores[0];
    const alternate = keyScores[1];

    let confidenceRating: "High" | "Medium" | "Low" = "Low";
    if (primary.correlation > 0.65) {
      confidenceRating = "High";
    } else if (primary.correlation > 0.45) {
      confidenceRating = "Medium";
    }

    return {
      primaryName: primary.name,
      primaryIndex: primary.keyIndex,
      isMajor: primary.isMajor,
      confidence: confidenceRating,
      alternateName: alternate.name,
      correlation: primary.correlation,
    };
  }, [noteEvents]);

  // Chord progression & Transpose configuration
  const [chordComplexity, setChordComplexity] = React.useState<"Simple" | "Rich" | "Bollywoodish">("Bollywoodish");
  const [selectedCapoOption, setSelectedCapoOption] = React.useState<CapoOption | null>(null);

  // Theory states
  const [explanation, setExplanation] = React.useState<TheoryExplanation | null>(null);
  const [loadingExplanation, setLoadingExplanation] = React.useState(false);

  // Soundwave visuals for high-polished tuner background
  const [waveHeights, setWaveHeights] = React.useState<number[]>(new Array(16).fill(4));

  // Note log/timeline for educational feedback
  const [noteTimeline, setNoteTimeline] = React.useState<string[]>([]);

  // Update soundwave animation mock or driven by actual analyzer values
  React.useEffect(() => {
    if (isListening && analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      const updateWave = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        // sample active values
        const heights = [];
        const step = Math.floor(dataArray.length / 16);
        for (let i = 0; i < 16; i++) {
          const val = dataArray[i * step] || 0;
          heights.push(Math.max(4, Math.floor(val / 6)));
        }
        setWaveHeights(heights);
        animationIdRef.current = requestAnimationFrame(updateWave);
      };
      animationIdRef.current = requestAnimationFrame(updateWave);
    } else {
      setWaveHeights(new Array(16).fill(4));
    }
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [isListening]);

  // Clean note events rolling window (keep last 8 seconds)
  React.useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setNoteEvents((prev) => prev.filter((evt) => now - evt.timestamp < 8000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Clear estimated-key if capo option was for another progression key, reset capo choice when estimated key primary root changes.
  const prevPrimaryNameRef = React.useRef<string>("");
  React.useEffect(() => {
    if (estimatedKey?.primaryName && estimatedKey.primaryName !== prevPrimaryNameRef.current) {
      setSelectedCapoOption(null);
      setExplanation(null);
      prevPrimaryNameRef.current = estimatedKey.primaryName;
    }
  }, [estimatedKey?.primaryName]);

  // Main high-frequency pitch analysis runner
  const performLivePitchAnalysis = React.useCallback(() => {
    if (!analyserRef.current || !isListening) return;

    const bufferLength = analyserRef.current.fftSize;
    const dataArray = new Float32Array(bufferLength);
    analyserRef.current.getFloatTimeDomainData(dataArray);

    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    
    // Auto-correlate fundamental frequency
    const detected = autoCorrelate(dataArray, sampleRate);
    
    // Calculate live signal noise RMS for visual feedback & checking activity
    let valSum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      valSum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(valSum / dataArray.length);
    setMicRms(rms);

    if (detected.frequency > 0 && detected.confidence > 0.72) {
      const noteData = frequencyToNote(detected.frequency);
      if (noteData) {
        noteData.confidence = detected.confidence;
        setCurrentPitch(noteData);

        // Update vocal range tracking if active
        if (rangeSessionActiveRef.current) {
          setRangeNotes((prev) => {
            const lastNote = prev[prev.length - 1];
            if (lastNote && lastNote.noteName === noteData.noteName && lastNote.octave === noteData.octave) {
              return prev;
            }
            return [...prev, noteData];
          });
        }

        // Update note timeline count tracking
        setNoteEvents((prev) => [
          ...prev,
          {
            noteIndex: noteData.noteIndex,
            confidence: detected.confidence,
            timestamp: Date.now(),
          },
        ]);

        // Push to human-readable scrolling visual note ledger tracker
        setNoteTimeline((prev) => {
          const cleanName = noteData.noteName + noteData.octave;
          if (prev[prev.length - 1] === cleanName) return prev; // Avoid duplicate consecutive spam
          const updated = [...prev, cleanName];
          if (updated.length > 8) updated.shift();
          return updated;
        });

        // Track live scrolling average frequency to render subtle historic waveform
        setRecentFrequencies((prev) => {
          const updated = [...prev, detected.frequency];
          if (updated.length > 30) updated.shift();
          return updated;
        });
      }
    } else {
      // Clear current live pitch to show idle tuning, but preserve history
      setCurrentPitch(null);
    }
  }, [
    isListening,
    setMicRms,
    setCurrentPitch,
    setNoteEvents,
    setNoteTimeline,
    setRecentFrequencies,
    setRangeNotes
  ]);

  // Audio stream activation
  const startListeningSession = async () => {
    try {
      setMicError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048; // Large enough window to capture base vocal depths (e.g. 80Hz)
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsListening(true);
    } catch (err: any) {
      console.error("Microphone activation failed:", err);
      setMicError("Microphone access is required to listen to your singing. Please enable permissions.");
    }
  };

  const stopListeningSession = () => {
    setIsListening(false);
    setCurrentPitch(null);
    setMicRms(0);

    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    if (audioContextRef.current) {
      if (audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  // Run the analysis loops at stable ~15 FPS rates using an interval
  React.useEffect(() => {
    let pitchInterval: any;
    if (isListening) {
      pitchInterval = setInterval(() => {
        performLivePitchAnalysis();
      }, 70); // ~14 updates per second fits perfectly for low latency + great CPU efficiency
    }
    return () => {
      if (pitchInterval) {
        clearInterval(pitchInterval);
      }
    };
  }, [isListening, performLivePitchAnalysis]);

  const resetRollingScaleLogs = () => {
    setNoteEvents([]);
    setNoteTimeline([]);
    setRecentFrequencies([]);
    setExplanation(null);
    setSelectedCapoOption(null);
  };

  // Generate chord progressions based on current active estimation
  const activeKeyIndex = estimatedKey ? estimatedKey.primaryIndex : 0; // default C
  const activeIsMajor = estimatedKey ? estimatedKey.isMajor : true;

  const suggestedProgressions = buildChordsForKey(
    activeKeyIndex,
    activeIsMajor,
    chordComplexity
  );

  const mainProgression = suggestedProgressions[0];
  const originalProgressionChords = mainProgression ? mainProgression.chords : [];

  // Generate transposed capo helper options for the progression
  const capoSuggestions = getCapoSuggestions(
    activeKeyIndex,
    activeIsMajor,
    originalProgressionChords
  );

  // Compute real-time range stats
  const rangeStats = React.useMemo(() => {
    if (rangeNotes.length === 0) return null;

    let lowest = rangeNotes[0];
    let highest = rangeNotes[0];
    let minMidi = (lowest.octave + 1) * 12 + lowest.noteIndex;
    let maxMidi = (highest.octave + 1) * 12 + highest.noteIndex;

    rangeNotes.forEach((note) => {
      const noteMidi = (note.octave + 1) * 12 + note.noteIndex;
      if (noteMidi < minMidi) {
        minMidi = noteMidi;
        lowest = note;
      }
      if (noteMidi > maxMidi) {
        maxMidi = noteMidi;
        highest = note;
      }
    });

    // Scale notes of current key
    let inKeyCount = 0;
    const scaleDegrees = estimatedKey 
      ? getScaleNotes(estimatedKey.primaryIndex, estimatedKey.isMajor)
      : [];

    rangeNotes.forEach((note) => {
      if (scaleDegrees.length === 0 || scaleDegrees.includes(note.noteIndex)) {
        inKeyCount++;
      }
    });

    const inKeyPercentage = Math.round((inKeyCount / rangeNotes.length) * 100);
    const semitonesSpan = maxMidi - minMidi;
    const octavesSpan = (semitonesSpan / 12).toFixed(1);

    return {
      lowest,
      highest,
      semitonesSpan,
      octavesSpan,
      inKeyPercentage,
      notesCount: rangeNotes.length,
      minMidi,
      maxMidi,
    };
  }, [rangeNotes, estimatedKey]);

  const handleAnalyzeVocalRange = async () => {
    if (!rangeStats) return;

    toggleRangeSession(false);
    setLoadingRangeReport(true);
    setSessionReport(null);

    try {
      if (!navigator.onLine) {
        throw new Error("OfflineModeActive");
      }
      const response = await fetch("/api/range", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lowestNote: rangeStats.lowest.noteName + rangeStats.lowest.octave,
          highestNote: rangeStats.highest.noteName + rangeStats.highest.octave,
          lowestFreq: rangeStats.lowest.frequency,
          highestFreq: rangeStats.highest.frequency,
          estimatedKey: estimatedKey ? estimatedKey.primaryName : "Unknown Key",
          inKeyPercentage: rangeStats.inKeyPercentage,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setSessionReport({
          lowest: rangeStats.lowest,
          highest: rangeStats.highest,
          semitonesSpan: rangeStats.semitonesSpan,
          octavesSpan: rangeStats.octavesSpan,
          inKeyPercentage: rangeStats.inKeyPercentage,
          notesCount: rangeStats.notesCount,
          classification: data.classification,
          keyHarmonyFeedback: data.keyHarmonyFeedback,
          lowerAdvice: data.lowerAdvice,
          upperAdvice: data.upperAdvice,
          exercises: data.exercises,
          isOfflineReport: false,
        });
      } else {
        throw new Error(data.error || "Failed loading vocal range feedback");
      }
    } catch (err) {
      console.error(err);
      setSessionReport({
        lowest: rangeStats.lowest,
        highest: rangeStats.highest,
        semitonesSpan: rangeStats.semitonesSpan,
        octavesSpan: rangeStats.octavesSpan,
        inKeyPercentage: rangeStats.inKeyPercentage,
        notesCount: rangeStats.notesCount,
        classification: "Determining...",
        keyHarmonyFeedback: `You stayed in-key ${rangeStats.inKeyPercentage}% of the time inside the scale. Staying inside the key's typical range avoids melodic clashes and makes your singing sound beautifully resonant.`,
        lowerAdvice: `To expand down from ${rangeStats.lowest.noteName}${rangeStats.lowest.octave} safely, relax your throat, let your larynx lower naturally, and drop your posture slightly to warm your chest tone.`,
        upperAdvice: `To expand past ${rangeStats.highest.noteName}${rangeStats.highest.octave}, utilize head resonance, lift your soft palate (as if starting to yawn), and use diaphragmatic breath support.`,
        exercises: [
          "Lip Trill Sirens (3 mins): Glide gently from low to high on completely relaxed lips.",
          "Mouth Resonance Hum (2 mins): Humm resonant 'm' intervals to stretch the muscles softly.",
          "Soft Vowel Slides (3 mins): Slide upward on a gentle 'Ooo' sound to release head voice tension."
        ],
        isOfflineReport: true,
      });
    } finally {
      setLoadingRangeReport(false);
    }
  };

  // Trigger server-side Gemini Music Coach api route
  const handleFetchTheoryExplanation = async () => {
    if (!estimatedKey || originalProgressionChords.length === 0) return;
    try {
      setLoadingExplanation(true);
      setExplanation(null);

      if (!navigator.onLine) {
        // Instantly generate and assign the local offline theory lesson
        const localLesson = generateLocalOfflineTheory(estimatedKey.primaryName, estimatedKey.isMajor);
        setExplanation(localLesson);
        return;
      }

      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: estimatedKey.primaryName,
          alternateKey: estimatedKey.alternateName,
          mode: estimatedKey.isMajor ? "major" : "minor",
          progressionStyle: chordComplexity,
          progressionChords: originalProgressionChords,
          complexity: chordComplexity === "Bollywoodish" ? "Rich" : chordComplexity,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setExplanation(data);
      } else {
        throw new Error(data.error || "Failed loading AI feedback");
      }
    } catch (err) {
      console.error(err);
      // Fallback on standard offline layout if online fetch completely breaks down
      const localLesson = generateLocalOfflineTheory(estimatedKey.primaryName, estimatedKey.isMajor);
      setExplanation(localLesson);
    } finally {
      setLoadingExplanation(false);
    }
  };

  // Render notes activity distribution data to construct educational bars
  const noteDistributionWeights = React.useMemo(() => {
    const weights = new Array(12).fill(0);
    noteEvents.forEach((evt) => {
      weights[evt.noteIndex] += 1;
    });
    const maxVal = Math.max(...weights);
    return { weights, maxVal: maxVal || 1 };
  }, [noteEvents]);

  return (
    <main className="min-h-screen w-full md:bg-[#090A0D] text-[#E0E0E0] md:py-6 flex items-center justify-center selection:bg-[#F27D26] selection:text-black font-sans" id="main-container">
      {/* MOBILE SHELL SIMULATION */}
      <div className="w-full h-full min-h-screen md:min-h-0 md:max-w-[410px] md:h-[820px] md:rounded-[36px] md:border-8 md:border-[#22252C] md:shadow-[0_24px_64px_rgba(0,0,0,0.8)] md:relative flex flex-col bg-[#0A0B0E] overflow-hidden" id="vocal-lab-mobile-shell">
        
        {/* iOS SIMULATED TOP BAR */}
        <div className="hidden md:flex items-center justify-between px-6 pt-3 pb-1 text-[9px] font-mono text-zinc-500 bg-[#0A0B0E] select-none">
          <span>9:41</span>
          <div className="w-20 h-3.5 bg-zinc-950/40 rounded-full border border-zinc-800/40" />
          <div className="flex items-center gap-1">
            <span className={isOnline ? "text-zinc-500 transition-colors" : "text-amber-500 font-bold transition-colors"}>
              {isOnline ? "5G" : "Offline"}
            </span>
            <div className="w-3.5 h-1.5 border border-zinc-500 rounded-sm relative flex items-center p-0.5">
              <div className={`w-full h-full rounded-2xs ${isOnline ? "bg-[#00FF41]" : "bg-amber-500 animate-pulse"}`} />
            </div>
          </div>
        </div>

        {/* MOBILE APP HEADER */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-[#2A2D35]/60 bg-[#12141A]/50 shrink-0 z-30">
          <div className="flex items-center gap-2">
            <Mic className="w-3.5 h-3.5 text-[#F27D26]" />
            <span className="text-[10px] font-black tracking-widest font-mono text-zinc-300">VOCAL LAB</span>
            {!isOnline && (
              <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/35 text-[8px] font-black tracking-wider text-amber-500 rounded flex items-center gap-0.5 font-mono select-none animate-pulse">
                <WifiOff className="w-2 h-2 shrink-0" />
                LOCAL
              </span>
            )}
          </div>

          {/* Engine Active Toggle */}
          <div className="flex items-center gap-2">
            {isListening && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FF41] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#00FF41]"></span>
              </span>
            )}
            <button
              onClick={isListening ? stopListeningSession : startListeningSession}
              className={`px-2.5 py-0.5 font-mono text-[8px] uppercase font-bold tracking-wider transition-all border rounded-md cursor-pointer ${
                isListening
                  ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
                  : "bg-[#00FF41]/10 border-[#00FF41]/30 text-[#00FF41] hover:bg-[#00FF41]/20"
              }`}
            >
              {isListening ? "Stop" : "Listen"}
            </button>
          </div>
        </header>

        {/* Mic Error Notice */}
        {micError && (
          <div className="bg-red-955/20 border-b border-red-900/40 px-3 py-1.5 text-[9px] text-red-300 flex gap-1.5 animate-pulse" id="mic-error-notice">
            <Info className="w-3 h-3 shrink-0 text-red-400 mt-0.5" />
            <p>{micError}</p>
          </div>
        )}

        {/* SCROLLABLE VIEWPORT CONTENT */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none pb-20 p-3 space-y-3" id="main-viewport">
          <AnimatePresence mode="wait">
            
            {/* TUNER TAB */}
            {activeTab === "tuner" && (
              <motion.div
                key="tuner"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.12 }}
                className="space-y-3"
              >
                {/* Center Pitch Monitor */}
                <div className="bg-[#15171C] border border-[#2A2D35] p-4 rounded-xl flex flex-col justify-center relative overflow-hidden min-h-[250px]" id="pitch-monitor">
                  <div className="absolute top-2.5 left-3 text-[8px] font-mono text-white/30 uppercase tracking-wider">Real-time Pitch</div>
                  
                  {isListening ? (
                    currentPitch ? (
                      <div className="flex flex-col items-center justify-center text-center py-2">
                        <div className="text-[72px] font-light leading-none tracking-tighter text-white select-none drop-shadow-[0_0_15px_rgba(242,125,38,0.15)] flex items-baseline">
                          {currentPitch.noteName}
                          <span className="text-2xl font-bold ml-0.5 text-[#F27D26]">{currentPitch.octave}</span>
                        </div>
                        <div className="text-sm font-mono text-[#00FF41] mt-0.5 font-bold">
                          {currentPitch.frequency.toFixed(2)} <span className="text-[10px]">Hz</span>
                        </div>
                        
                        {/* Cents Gauge */}
                        <div className="w-full mt-4">
                          <div className="flex justify-between text-[8px] font-mono mb-1 opacity-50 uppercase">
                            <span>-50c</span>
                            <span className={Math.abs(currentPitch.cents) <= 10 ? "text-[#00FF41] font-bold" : "text-[#F27D26]"}>
                              {Math.abs(currentPitch.cents) <= 10 ? "IN TUNE" : currentPitch.cents > 0 ? "SHARP" : "FLAT"}
                            </span>
                            <span>+50c</span>
                          </div>
                          <div className="h-2 w-full bg-[#0F1115] border border-[#2A2D35] relative rounded-sm overflow-hidden">
                            <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-[#F27D26]/40 z-10" />
                            <div className="absolute left-[45%] top-0 bottom-0 w-[10%] bg-[#00FF41]/10" />
                            <motion.div 
                              className="absolute top-0 bottom-0 w-1 bg-[#F27D26]"
                              animate={{ left: `${50 + (currentPitch.cents / 50) * 50}%` }}
                              transition={{ type: "spring", stiffness: 180, damping: 15 }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center py-6">
                        <div className="flex items-center justify-center gap-1 mb-4 h-6">
                          {waveHeights.map((h, i) => (
                            <motion.div
                              key={i}
                              className="w-0.5 bg-[#F27D26] rounded-full"
                              animate={{ height: Math.max(4, h * 1.1) }}
                              transition={{ type: "spring", stiffness: 200, damping: 20 }}
                            />
                          ))}
                        </div>
                        <div className="text-[9px] font-mono text-[#F27D26] uppercase tracking-wider animate-pulse">Scanning vocal frequency...</div>
                        <p className="text-[10px] text-zinc-500 mt-1">Hum or play a note close to your mic</p>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-6 space-y-3">
                      <div className="w-10 h-10 rounded-full bg-[#0F1115] border border-[#2A2D35] flex items-center justify-center mx-auto text-zinc-500">
                        <MicOff className="w-4 h-4 text-zinc-400" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold font-mono uppercase tracking-wider text-zinc-400">Tuner Engine Paused</p>
                        <p className="text-[9px] text-zinc-550 max-w-[180px] mx-auto leading-tight">Turn on the engine to analyze your pitch</p>
                      </div>
                      <button
                        onClick={startListeningSession}
                        className="px-3.5 py-1.5 bg-[#F27D26] hover:bg-[#F27D26]/90 text-black text-[9px] font-black uppercase tracking-wider transition-all rounded-md font-mono"
                      >
                        Listen Live
                      </button>
                    </div>
                  )}
                </div>

                {/* VOCAL PATH LEDGER */}
                <div className="bg-[#15171C] border border-[#2A2D35] p-3 rounded-xl" id="vocal-path">
                  <div className="text-[8px] font-mono text-white/30 uppercase mb-2 tracking-wider">Vocal Ledger</div>
                  {noteTimeline.length > 0 ? (
                    <div className="flex flex-wrap gap-1" id="vocal-path-chips">
                      {noteTimeline.map((item, idx) => (
                        <span 
                          key={idx}
                          className={`px-1.5 py-0.5 text-[10px] font-bold font-mono rounded border transition-all ${
                            idx === noteTimeline.length - 1 
                              ? "bg-[#F27D26] text-black border-[#F27D26]" 
                              : "bg-[#0F1115] text-zinc-500 border-[#2A2D35]"
                          }`}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-zinc-600 font-mono py-0.5">
                      No active singing notes logged.
                    </div>
                  )}
                </div>

                {/* ESTIMATED SCALE DISPLAY */}
                <div className="bg-[#15171C] border border-[#2A2D35] p-3.5 rounded-xl flex flex-col" id="scale-detection-card">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[8px] font-mono text-white/30 uppercase tracking-wider">Detected Scale</span>
                    {estimatedKey && (
                      <button
                        onClick={resetRollingScaleLogs}
                        className="text-[8px] font-mono text-[#F27D26] hover:underline uppercase"
                      >
                        Reset logs
                      </button>
                    )}
                  </div>

                  {noteEvents.length < 5 ? (
                    <div className="flex flex-col items-center justify-center p-3 text-center rounded bg-[#0F1115]/30 border border-dashed border-[#2A2D35]">
                      <Layers className="w-4 h-4 text-zinc-700 mb-1" />
                      <p className="text-[10px] font-semibold text-zinc-400">Capturing Scale Notes...</p>
                      <div className="text-[9px] text-zinc-500 mt-1">
                        Sing 5+ different keys. Current count: <span className="text-[#F27D26] font-bold">{noteEvents.length}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <div>
                          <div className="text-xl font-black text-white leading-tight">
                            {estimatedKey ? formatFlatName(estimatedKey.primaryName).split(" ")[0] : "Estimating"}
                            <span className="text-[#F27D26] italic font-normal text-sm ml-1">
                              {estimatedKey ? (estimatedKey.isMajor ? "Major" : "Minor") : ""}
                            </span>
                          </div>
                          <div className="text-[9px] text-zinc-500 font-mono mt-0.5">
                            Alt match: {estimatedKey ? formatFlatName(estimatedKey.alternateName) : "..."}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-mono text-[#00FF41] font-bold">
                            {estimatedKey ? (estimatedKey.correlation * 100).toFixed(0) : "0"}% Match
                          </span>
                        </div>
                      </div>

                      {/* Pitch spread bar */}
                      <div className="border-t border-[#2A2D35]/50 pt-2.5">
                        <div className="grid grid-cols-12 gap-0.5 h-8 items-end" id="pitch-distribution-histogram">
                          {NOTE_NAMES.map((name, idx) => {
                            const count = noteDistributionWeights.weights[idx];
                            const rawHeight = (count / noteDistributionWeights.maxVal) * 100;
                            const heightPercent = count > 0 ? Math.max(10, rawHeight) : 2;
                            return (
                              <div key={idx} className="h-full flex items-end relative group justify-center">
                                <div 
                                  style={{ height: `${heightPercent}%` }}
                                  className={`w-full rounded-t-xs transition-all ${
                                    count > 0 ? "bg-[#F27D26]" : "bg-zinc-850"
                                  }`}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-[8px] font-mono text-zinc-600 mt-1">
                          <span>C</span>
                          <span>E</span>
                          <span>G</span>
                          <span>B</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* CHORDS TAB */}
            {activeTab === "chords" && (
              <motion.div
                key="chords"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.12 }}
                className="space-y-3"
              >
                <div className="bg-[#15171C] border border-[#2A2D35] p-3.5 rounded-xl space-y-3" id="chords-panel">
                  <div className="flex flex-col gap-2">
                    <span className="text-[8px] font-mono text-white/30 uppercase tracking-wider">Guitar Chord Suggestions</span>
                    
                    <div className="flex bg-[#0D0E12] p-0.5 border border-[#2A2D35] rounded-lg font-mono text-[8px] uppercase font-bold w-full">
                      {(["Simple", "Rich", "Bollywoodish"] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => {
                            setChordComplexity(mode);
                            setSelectedCapoOption(null);
                          }}
                          className={`flex-1 text-center py-1 rounded-md transition-all cursor-pointer ${
                            chordComplexity === mode ? "bg-[#F27D26] text-black" : "text-white/40"
                          }`}
                        >
                          {mode === "Bollywoodish" ? "Bollywood" : mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <div className="text-[11px] text-zinc-400">
                      <span className="text-white font-bold block">{suggestedProgressions[0]?.name || "Active Scale Harmony"}</span>
                      <p className="text-[10px] leading-snug text-zinc-550 mt-0.5">
                        {suggestedProgressions[0]?.description || "Scales suggestions based on detected core pitches."}
                      </p>
                    </div>

                    {/* Progressions cards */}
                    <div className="grid grid-cols-2 gap-2">
                      {(selectedCapoOption ? selectedCapoOption.chords : suggestedProgressions[0]?.chords || []).map((ch, cIndex) => {
                        const shapeObj = CHORD_SHAPES[ch];
                        const fretChain = shapeObj ? shapeObj.frets.split("").join("-") : "";
                        return (
                          <div 
                            key={cIndex}
                            className={`border-l h-14 bg-[#1E2026] p-2 rounded-r transition-all ${
                              selectedCapoOption ? "border-[#00FF41]" : "border-[#F27D26]"
                            }`}
                          >
                            <span className="text-[8px] opacity-30 font-mono block uppercase">
                              {suggestedProgressions[0]?.romanNumerals[cIndex]}
                            </span>
                            <span className="text-sm font-bold font-sans text-white leading-none block">
                              {formatFlatName(ch)}
                            </span>
                            <span className="text-[8px] opacity-30 font-mono block mt-1">
                              {fretChain || "x-x-x-x-x-x"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Beginner Capo Tip */}
                  {capoSuggestions.length > 0 && (
                    <div className="bg-[#0A0B0E] p-2.5 border border-dashed border-[#F27D26]/20 rounded-lg">
                      <div className="text-[8px] text-[#F27D26] uppercase font-bold font-mono">Simpler Guitar Capo Fret</div>
                      <p className="text-[10px] text-zinc-350 leading-tight mt-0.5">
                        Sing in key, play as <span className="text-white font-black">{formatFlatName(selectedCapoOption ? selectedCapoOption.easyKeyName : capoSuggestions[0].easyKeyName)}</span> with <span className="text-white font-black underline underline-offset-1">Capo Fret {selectedCapoOption ? selectedCapoOption.capoFret : capoSuggestions[0].capoFret}</span>
                      </p>
                    </div>
                  )}

                  {/* Scrollable Chord diagrams */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[8px] font-mono text-white/30 uppercase tracking-wider block">Chord Fingering Previews (Slide)</span>
                    <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                      {(selectedCapoOption ? selectedCapoOption.chords : suggestedProgressions[0]?.chords || []).slice(0, 4).map((ch, cIdx) => (
                        <div key={cIdx} className="shrink-0">
                          <GuitarChordDiagram chordName={ch} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Capo selectors chips list */}
                  {capoSuggestions.length > 0 && (
                    <div className="pt-2 border-t border-[#2A2D35]/40 text-left">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[8px] font-mono text-white/30 uppercase">Capo Shifts</span>
                        {selectedCapoOption && (
                          <button onClick={() => setSelectedCapoOption(null)} className="text-[8px] text-[#F27D26]">Original</button>
                        )}
                      </div>
                      <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                        {capoSuggestions.slice(0, 4).map((opt, oIdx) => {
                          const active = selectedCapoOption?.capoFret === opt.capoFret;
                          return (
                            <button
                              key={oIdx}
                              onClick={() => setSelectedCapoOption(opt)}
                              className={`px-2 py-0.5 text-[8px] font-mono rounded cursor-pointer shrink-0 transition-all border ${
                                active ? "bg-[#F27D26] text-black border-[#F27D26]" : "bg-[#0A0B0E] border-[#2A2D35] text-zinc-400"
                              }`}
                            >
                              Fret {opt.capoFret} ({formatFlatName(opt.easyKeyName)})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* RANGE TAB */}
            {activeTab === "range" && (
              <motion.div
                key="range"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.12 }}
                className="space-y-3"
              >
                <div className="bg-[#15171C] border border-[#2A2D35] p-3.5 flex flex-col rounded-xl" id="vocal-range-studio-card">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#2A2D35]/30">
                    <div className="flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-[#00FF41]" />
                      <span className="text-[9px] font-mono text-[#00FF41] uppercase font-bold tracking-wider">Vocal limits studio</span>
                    </div>
                    {rangeSessionActive && (
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                      </span>
                    )}
                  </div>

                  {!rangeSessionActive && !loadingRangeReport && !sessionReport && (
                    <div className="space-y-3 flex flex-col justify-between">
                      <div className="space-y-1">
                        <p className="text-zinc-300 font-semibold text-xs leading-snug">Sing to map lowest/highest registers.</p>
                        <p className="text-[10px] text-zinc-500 leading-snug font-sans">
                          A high-resolution scanning test. Sing your absolute lowest chest note then slide up to your highest head register.
                        </p>
                      </div>
                      <button
                        onClick={() => toggleRangeSession(true)}
                        className="w-full py-2 bg-[#00FF41]/10 border border-[#00FF41]/40 text-[#00FF41] text-[9px] uppercase font-black tracking-widest rounded-lg cursor-pointer font-mono"
                        id="start-range-test-btn"
                      >
                        Start Range Test
                      </button>
                    </div>
                  )}

                  {rangeSessionActive && (
                    <div className="space-y-3 flex flex-col text-xs">
                      <div className="bg-[#0F1115] border border-[#2A2D35] rounded-lg p-2 text-center">
                        <span className="text-[8px] font-mono text-red-500 uppercase tracking-widest block font-bold animate-pulse">Session Active</span>
                        <p className="text-[10px] text-zinc-400">Sing now... slide from low to high</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="bg-[#0F1115] border border-[#2A2D35] p-1.5 rounded-lg text-center">
                          <span className="text-[8px] font-mono text-zinc-550 uppercase block">Lowest</span>
                          <span className="text-sm font-bold font-mono text-white block">
                            {rangeStats?.lowest ? `${rangeStats.lowest.noteName}${rangeStats.lowest.octave}` : "---"}
                          </span>
                        </div>
                        <div className="bg-[#0F1115] border border-[#2A2D35] p-1.5 rounded-lg text-center">
                          <span className="text-[8px] font-mono text-zinc-550 uppercase block">Highest</span>
                          <span className="text-sm font-bold font-mono text-[#F27D26] block">
                            {rangeStats?.highest ? `${rangeStats.highest.noteName}${rangeStats.highest.octave}` : "---"}
                          </span>
                        </div>
                      </div>

                      <div className="relative h-1.5 w-full bg-[#0F1115] border border-[#2A2D35] rounded-full overflow-visible my-1">
                        {rangeStats && (
                          <div 
                            style={{ 
                              left: `${Math.min(100, Math.max(0, ((rangeStats.minMidi - 36) / 60) * 100))}%`, 
                              width: `${Math.min(100, Math.max(1, (((rangeStats.maxMidi - rangeStats.minMidi) / 60) * 100)))}%` 
                            }}
                            className="absolute top-0 bottom-0 bg-[#F27D26]/40 rounded-full" 
                          />
                        )}
                      </div>

                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => toggleRangeSession(false)}
                          className="flex-1 py-1.5 bg-transparent border border-[#2A2D35] text-zinc-450 text-[9px] uppercase font-bold rounded cursor-pointer font-mono"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAnalyzeVocalRange}
                          disabled={!rangeStats || rangeStats.notesCount < 1}
                          className="flex-1 py-1.5 bg-[#F27D26] text-black text-[9px] font-black uppercase rounded cursor-pointer font-mono text-center disabled:opacity-40"
                          id="finish-range-test-btn"
                        >
                          Analyze Range
                        </button>
                      </div>
                    </div>
                  )}

                  {loadingRangeReport && (
                    <div className="py-8 flex flex-col items-center justify-center space-y-2">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00FF41]" />
                      <span className="text-[9px] font-mono text-[#00FF41] animate-pulse uppercase block">Analyzing register boundaries...</span>
                    </div>
                  )}

                  {sessionReport && !loadingRangeReport && (
                    <div className="text-[10px] leading-relaxed text-zinc-300 space-y-3.5 max-h-[360px] overflow-y-auto scrollbar-none" id="range-report-view">
                      {sessionReport.isOfflineReport && (
                        <div className="bg-amber-500/10 border border-amber-500/25 text-amber-500 p-2.5 rounded-lg text-[9px] font-mono leading-tight mb-2" id="offline-report-badge">
                          <span className="font-bold uppercase block text-[8px] mb-0.5">⚠️ Local Offline Analysis</span>
                          Real-time Gemini AI analysis is unavailable while offline, but your register was fully mapped by our high-precision local pitch engine.
                        </div>
                      )}

                      <div className="text-center bg-[#0F1115] border border-[#2A2D35] p-2.5 rounded-lg">
                        <span className="text-[8px] uppercase font-mono text-[#00FF41] block">Identified Range</span>
                        <div className="text-lg font-black text-white tracking-tight my-0.5">
                          {sessionReport.lowest.noteName}{sessionReport.lowest.octave} - {sessionReport.highest.noteName}{sessionReport.highest.octave}
                        </div>
                        <span className="inline-block px-2 py-0.5 bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/20 rounded text-[8px] font-mono uppercase font-black">
                          {sessionReport.classification}
                        </span>
                      </div>

                      {/* Scale stay percentage */}
                      <p className="text-[10px] text-zinc-400 border-t border-[#2A2D35] pt-2">
                        <span className="text-white block font-semibold mb-0.5">In-Key Alignment: {sessionReport.inKeyPercentage}%</span>
                        {sessionReport.keyHarmonyFeedback}
                      </p>

                      {/* Register expansion advice */}
                      <div className="border-t border-[#2A2D35]/60 pt-2 space-y-2 text-[10px]">
                        <div>
                          <span className="text-[#00FF41] font-mono uppercase block font-bold text-[8px]">Lower Register Extension</span>
                          <p className="mt-0.5 text-zinc-400">{sessionReport.lowerAdvice}</p>
                        </div>
                        <div>
                          <span className="text-[#00FF41] font-mono uppercase block font-bold text-[8px]">Upper Register Expansion</span>
                          <p className="mt-0.5 text-zinc-400">{sessionReport.upperAdvice}</p>
                        </div>
                      </div>

                      {/* Training Drills */}
                      {sessionReport.exercises && sessionReport.exercises.length > 0 && (
                        <div className="border-t border-[#2A2D35] pt-2 text-[10px]">
                          <span className="text-[#F27D26] uppercase font-mono block text-[8px] font-bold mb-1">Recommended workouts</span>
                          <div className="space-y-1 text-[#E0E0E0]/80">
                            {sessionReport.exercises.map((drill: string, dIdx: number) => (
                              <p key={dIdx} className="leading-snug">
                                <span className="text-[#00FF41] font-mono font-bold mr-1">{dIdx + 1}.</span>
                                {drill}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setSessionReport(null);
                          setRangeNotes([]);
                        }}
                        className="w-full py-1.5 mt-1 border border-[#2A2D35] text-zinc-400 text-[9px] uppercase font-bold rounded-lg cursor-pointer font-mono"
                      >
                        New Range Scan
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* THEORY AI TAB */}
            {activeTab === "theory" && (
              <motion.div
                key="theory"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.12 }}
                className="space-y-3"
              >
                {estimatedKey ? (
                  <div className="bg-[#15171C] border border-[#2A2D35] p-4 flex flex-col rounded-xl" id="theory-explainer">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#F27D26]" />
                        <span className="text-[10px] font-mono text-[#F27D26] uppercase font-bold tracking-wider">Gemini Theory Coach</span>
                      </div>

                      {!explanation && (
                        <button
                          onClick={handleFetchTheoryExplanation}
                          disabled={loadingExplanation}
                          className="text-[9px] uppercase font-mono text-[#F27D26] hover:underline cursor-pointer"
                        >
                          Generate Lesson
                        </button>
                      )}
                    </div>

                    {loadingExplanation && (
                      <div className="py-10 flex flex-col items-center justify-center space-y-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#F27D26]" />
                        <span className="text-[9px] font-mono text-[#F27D26] animate-pulse uppercase">Formulating AI advice...</span>
                      </div>
                    )}

                    {!explanation && !loadingExplanation && (
                      <div className="text-[11px] leading-relaxed text-zinc-400 space-y-3 mt-1 flex flex-col">
                        <p>We captured your register centered in the key of <span className="text-white font-bold">{formatFlatName(estimatedKey.primaryName)}</span>.</p>
                        <p>
                          {isOnline 
                            ? "Generate vocal lessons, Punjabi and Bollywood melody crossover breakdowns, and tailored practicing checklist steps." 
                            : "You are currently offline. You can generate a comprehensive local scale lesson instantly without connection!"}
                        </p>
                        
                        <button
                          onClick={handleFetchTheoryExplanation}
                          className="w-full py-2 bg-[#F27D26]/10 hover:bg-[#F27D26]/20 border border-[#F27D26]/30 text-[#F27D26] text-[9px] uppercase font-black tracking-widest rounded-lg cursor-pointer font-mono mt-2"
                        >
                          {isOnline ? "Create Custom Lesson" : "Load Offline Scale Lesson"}
                        </button>
                      </div>
                    )}

                    {explanation && !loadingExplanation && (
                      <div className="text-[10px] leading-relaxed text-[#E0E0E0]/80 space-y-3.5 max-h-[440px] overflow-y-auto scrollbar-none pr-1">
                        {!isOnline && (
                          <div className="bg-amber-500/10 border border-amber-500/25 text-amber-500 p-2.5 rounded-lg text-[8px] font-mono leading-tight mb-1" id="offline-theory-lesson-badge">
                            <span className="font-bold uppercase block text-[7px] mb-0.5">📶 Offline Mode</span>
                            Showing local scale tutorial. Reconnect to access live personalized AI Coach queries.
                          </div>
                        )}

                        <p className="text-zinc-300">
                          We mapped your voice to the scale of <span className="text-white font-bold">{formatFlatName(estimatedKey.primaryName)}</span>.
                          {" "}{explanation.explanation}
                        </p>

                        {explanation.bollywoodConnections && (
                          <div className="border-t border-[#2A2D35] pt-2">
                            <span className="text-[8px] font-mono text-[#F27D26] uppercase block font-bold mb-0.5">Bollywood &amp; Crossover Songs</span>
                            <p className="text-zinc-400 leading-normal italic">{explanation.bollywoodConnections}</p>
                          </div>
                        )}

                        {explanation.practiceTips && explanation.practiceTips.length > 0 && (
                          <div className="border-t border-[#2A2D35] pt-2 text-[10px]">
                            <span className="text-[#00FF41] uppercase font-mono block text-[8px] font-bold mb-1">Functional practice checklist</span>
                            <div className="space-y-1 text-zinc-400">
                              {explanation.practiceTips.map((tip, idx) => (
                                <p key={idx} className="leading-snug">
                                  <span className="text-[#F27D26] font-mono font-bold mr-1">0{idx + 1}.</span>
                                  {tip}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={handleFetchTheoryExplanation}
                          className="w-full py-1.5 bg-transparent border border-[#2A2D35] text-zinc-400 text-[8px] uppercase font-semibold rounded-lg mt-2 cursor-pointer transition-colors hover:text-white"
                        >
                          Refresh Theory Lesson
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#15171C] border border-[#2A2D35] p-5 flex flex-col items-center justify-center text-center rounded-xl min-h-[180px]">
                    <Sparkles className="w-6 h-6 text-zinc-800 animate-pulse mb-2" />
                    <span className="text-[9px] font-mono text-zinc-600 uppercase block font-bold mb-1">Vocal metrics low</span>
                    <p className="text-[10px] text-zinc-500 font-sans max-w-[180px] leading-tight">
                      Theory and coaching lessons require vocal data. Sing or hum keys on the Tuner tab!
                    </p>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Gentle persist toast when offline */}
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="absolute bottom-[66px] left-3.5 right-3.5 bg-[#1C140E] border border-amber-500/25 backdrop-blur-md px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-1.5 z-40 shadow-lg shadow-black/40"
              id="offline-toast"
            >
              <div className="flex items-center gap-2">
                <div className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-extrabold font-mono text-amber-500 uppercase tracking-wide">Offline Mode Active</span>
                  <span className="text-[8px] text-zinc-400 leading-normal">Local real-time tuner &amp; chord maps are 100% active.</span>
                </div>
              </div>
              <span className="text-[7.5px] font-mono font-bold text-amber-500/80 bg-amber-500/5 px-1 py-0.5 rounded border border-amber-500/15 shrink-0 select-none uppercase">Local State</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* BOTTOM TAB LIST BAR */}
        <nav className="absolute bottom-0 left-0 right-0 h-14 bg-[#12141A]/95 backdrop-blur-md border-t border-[#2A2D35]/50 flex items-center justify-around z-45 pb-safe select-none">
          <button
            onClick={() => setActiveTab("tuner")}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center cursor-pointer transition-colors duration-150 ${
              activeTab === "tuner" ? "text-[#F27D26]" : "text-zinc-500 hover:text-zinc-400"
            }`}
          >
            <Mic className="w-4 h-4 mb-0.5" />
            <span className="text-[9px] font-medium font-sans tracking-tight">Tuner</span>
          </button>
          <button
            onClick={() => setActiveTab("chords")}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center cursor-pointer transition-colors duration-150 ${
              activeTab === "chords" ? "text-[#F27D26]" : "text-zinc-500 hover:text-zinc-400"
            }`}
          >
            <Music className="w-4 h-4 mb-0.5" />
            <span className="text-[9px] font-medium font-sans tracking-tight">Chords</span>
          </button>
          <button
            onClick={() => setActiveTab("range")}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center cursor-pointer transition-colors duration-150 ${
              activeTab === "range" ? "text-[#00FF41]" : "text-zinc-500 hover:text-zinc-400"
            }`}
          >
            <Activity className="w-4 h-4 mb-0.5" />
            <span className="text-[9px] font-medium font-sans tracking-tight">Range</span>
          </button>
          <button
            onClick={() => setActiveTab("theory")}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center cursor-pointer transition-colors duration-150 ${
              activeTab === "theory" ? "text-[#F27D26]" : "text-zinc-500 hover:text-zinc-400"
            }`}
          >
            <Sparkles className="w-4 h-4 mb-0.5" />
            <span className="text-[9px] font-medium font-sans tracking-tight">AI Coach</span>
          </button>
        </nav>

        {/* INTEGRATED INPUT LEVEL VU METER */}
        {isListening && (
          <div className="absolute bottom-14 left-0 right-0 h-0.5 bg-zinc-950/45 z-30">
            <div 
              style={{ width: `${Math.min(100, Math.floor(micRms * 1200))}%` }}
              className="h-full bg-gradient-to-r from-[#F27D26] to-[#00FF41] transition-all duration-75" 
            />
          </div>
        )}

      </div>
    </main>
  );
}
