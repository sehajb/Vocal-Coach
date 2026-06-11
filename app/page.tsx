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
  CapoOption,
  getFingersForChord,
  EXPLICIT_FINGERS
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
function GuitarChordDiagram({ 
  chordName, 
  isSelected = false, 
  onClick 
}: { 
  chordName: string; 
  isSelected?: boolean; 
  onClick?: () => void; 
}) {
  // Normalize flats to sharps for lookup
  const shape = CHORD_SHAPES[chordName];
  if (!shape) {
    return (
      <div 
        onClick={onClick}
        className="w-28 h-36 flex flex-col items-center justify-center border border-dashed border-zinc-700 rounded-lg p-2 bg-zinc-900/60 font-mono text-xs text-zinc-500 cursor-pointer"
      >
        <span>{chordName}</span>
        <span className="text-[10px] mt-1 text-center">Shape pending</span>
      </div>
    );
  }

  const { frets } = shape;
  const fretChars = frets.split(""); // e.g., ["x", "3", "2", "0", "1", "0"]
  const fingerString = getFingersForChord(chordName, frets);
  const fingerChars = fingerString.split(""); // e.g. ["x", "3", "2", "0", "1", "0"]
  
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

  // Detect if there is a barre (INDEX finger '1' pressing multiple strings on the same fret)
  const barreFretMap: Record<number, number[]> = {}; // fret -> active string indices
  fretChars.forEach((fChar, sIdx) => {
    const fNum = parseInt(fChar);
    const finger = fingerChars[sIdx];
    if (!isNaN(fNum) && fNum > 0 && finger === "1") {
      if (!barreFretMap[fNum]) {
        barreFretMap[fNum] = [];
      }
      barreFretMap[fNum].push(sIdx);
    }
  });

  let barreFret: number | null = null;
  let barreStrings: number[] = [];
  Object.entries(barreFretMap).forEach(([fret, stringIndices]) => {
    if (stringIndices.length >= 2) {
      barreFret = parseInt(fret);
      barreStrings = stringIndices;
    }
  });

  const relativeBarreFret = barreFret !== null ? barreFret - startFret + 1 : 0;
  const isDrawBarre = barreFret !== null && relativeBarreFret >= 1 && relativeBarreFret <= displayFretsCount;

  return (
    <div 
      onClick={onClick}
      className={`flex flex-col items-center bg-zinc-950/80 border rounded-2xl p-3 shadow-lg select-none cursor-pointer transition-all duration-200 w-28 ${
        isSelected 
          ? "border-[#F27D26] bg-[#16120E] shadow-[#F27D26]/5 ring-1 ring-[#F27D26]" 
          : "border-zinc-850 hover:border-zinc-700 hover:bg-zinc-900/60"
      }`}
    >
      <div className={`text-xs font-black truncate w-full text-center mb-1 font-sans tracking-wide transition-colors ${
        isSelected ? "text-[#F27D26]" : "text-zinc-200"
      }`}>
        {formatFlatName(chordName)}
      </div>
      <svg width={width} height={height} className="overflow-visible" id={`chord-svg-${chordName}`}>
        {/* Draw starting fret label if shifted */}
        {startFret > 1 && (
          <text 
            x={1} 
            y={paddingTop + 14} 
            fontSize="9" 
            fill="#a1a1aa" 
            className="font-mono font-bold"
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
          strokeWidth={startFret === 1 ? "3" : "1.2"} 
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
              stroke="#3f3f46" 
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
              stroke="#52525b" 
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
                <line x1={x - 2.5} y1={y - 2.5} x2={x + 2.5} y2={y + 2.5} stroke="#ef4444" strokeWidth="1.5" />
                <line x1={x + 2.5} y1={y - 2.5} x2={x - 2.5} y2={y + 2.5} stroke="#ef4444" strokeWidth="1.5" />
              </g>
            );
          } else if (char === "0") {
            return (
              <circle 
                key={sIdx} 
                cx={x} 
                cy={y} 
                r="2.5" 
                fill="none" 
                stroke="#10b981" 
                strokeWidth="1.5" 
              />
            );
          }
          return null;
        })}

        {/* Translucent Barre Pill shape (index finger cover) */}
        {isDrawBarre && (
          <rect
            x={getX(Math.min(...barreStrings)) - 4}
            y={getY(relativeBarreFret) - FretSpacing / 2 - 4}
            width={getX(Math.max(...barreStrings)) - getX(Math.min(...barreStrings)) + 8}
            height={8}
            rx={4}
            fill="#f59e0b"
            opacity="0.75"
          />
        )}

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

          // Finger label to display (1=Index, 2=Middle, 3=Ring, 4=Pinky, etc)
          const fMark = fingerChars[sIdx];
          const hasFingerLabel = fMark !== "x" && fMark !== "0";

          return (
            <g key={sIdx}>
              <circle 
                cx={cx} 
                cy={cy} 
                r="6" 
                fill={fMark === "1" ? "#e0a020" : "#fbbf24"} 
                className="shadow-sm"
              />
              <text 
                x={cx} 
                y={cy + 3} 
                fill="#000000" 
                fontSize="8.5" 
                fontWeight="black" 
                textAnchor="middle" 
                className="font-sans"
              >
                {hasFingerLabel ? fMark : fretNum}
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

// Generates beginner-friendly textual instructions for placing fingers on each string
function getBeginnerChordGuide(chordName: string) {
  const shape = CHORD_SHAPES[chordName];
  if (!shape) return null;

  const { frets } = shape;
  const fingerString = getFingersForChord(chordName, frets);
  
  const fretChars = frets.split("");
  const fingerChars = fingerString.split("");
  
  const stringNames = ["Low E (6th)", "A (5th)", "D (4th)", "G (3rd)", "B (2nd)", "High e (1st)"];
  const fingerNames: Record<string, string> = {
    "1": "Index Finger (1)",
    "2": "Middle Finger (2)",
    "3": "Ring Finger (3)",
    "4": "Pinky Finger (4)",
    "T": "Thumb (T)"
  };

  const steps: string[] = [];
  
  fretChars.forEach((fChar, sIdx) => {
    if (fChar === "x") {
      steps.push(`${stringNames[sIdx]} string: Mute (X) — do not strum or play.`);
    } else if (fChar === "0") {
      steps.push(`${stringNames[sIdx]} string: Leave Open (0) — let the note ring.`);
    } else {
      const fretNum = parseInt(fChar);
      const fMark = fingerChars[sIdx];
      const fingerText = fingerNames[fMark] || `Finger ${fMark}`;
      steps.push(`${stringNames[sIdx]} string: Place your ${fingerText} on Fret ${fretNum}.`);
    }
  });

  let tip = "Press with the perpendicular tips of your fingers (almost vertical to the wood) rather than flat pads so neighboring strings can ring freely.";
  
  const lowerName = chordName.toLowerCase();
  if (lowerName.includes("7")) {
    tip = "The 7th chord adds a jazzy, bluesy tension that pulls strongly back to the root key. Perfect for rich transitions!";
  } else if (lowerName.includes("maj7")) {
    tip = "A Major 7th chord is incredibly lush and dreamlike. Keep your fingers arched so that the open strings ring as clear as bells.";
  } else if (lowerName.includes("m") && !lowerName.includes("maj")) {
    tip = "Minor chords carry a beautiful melancholic, warm emotion. Ensure your fingers are snugly placed right behind the fret metal for pristine hum-free sound.";
  } else if (lowerName.includes("sus")) {
    tip = "Suspended chords build beautiful, floaty tension. Try resolving them by transitioning immediately into the standard Major chord of the same root!";
  } else if (lowerName === "f" || lowerName === "b" || lowerName === "f#" || lowerName === "bm" || lowerName === "cm" || lowerName.includes("#") || lowerName.includes("b")) {
    tip = "This is a bar (barre) chord shape. Squeeze the neck gently like a clamp between your flat index finger and your thumb supporting the back of the neck!";
  }

  return { steps, tip };
}

interface MatchedScale {
  name: string;
  keyIndex: number;
  isMajor: boolean;
  correlation: number;
  matchPercentage: number;
}

function getKeyCorrelations(counts: number[]): MatchedScale[] {
  const sumObserved = counts.reduce((a, b) => a + b, 0);
  if (sumObserved === 0) return [];

  const meanObs = sumObserved / 12;

  const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

  const candidates: MatchedScale[] = [];

  for (let isMajorSign = 0; isMajorSign <= 1; isMajorSign++) {
    const isMajor = isMajorSign === 1;
    const profile = isMajor ? MAJOR_PROFILE : MINOR_PROFILE;
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
      const keyName = NOTE_NAMES[keyIdx] + (isMajor ? " Major" : " Minor");

      const matchPercentage = Math.round(Math.max(0, correlation) * 100);

      candidates.push({
        name: keyName,
        keyIndex: keyIdx,
        isMajor,
        correlation,
        matchPercentage,
      });
    }
  }

  return candidates.sort((a, b) => b.correlation - a.correlation);
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

  // Smooth raw range notes using a rolling average filter to discard vocal cracks / momentary outliers
  const smoothedRangeNotes = React.useMemo<DetectionResult[]>(() => {
    if (rangeNotes.length === 0) return [];

    const ROLLING_WINDOW_SIZE = 5;
    const result: DetectionResult[] = [];

    for (let i = 0; i < rangeNotes.length; i++) {
      let sumMidi = 0;
      let count = 0;
      const start = Math.max(0, i - ROLLING_WINDOW_SIZE + 1);
      
      for (let k = start; k <= i; k++) {
        const note = rangeNotes[k];
        const midiVal = (note.octave + 1) * 12 + note.noteIndex;
        sumMidi += midiVal;
        count++;
      }

      const smoothedMidi = sumMidi / count;
      const roundedMidi = Math.round(smoothedMidi);
      
      const noteIndex = ((roundedMidi % 12) + 12) % 12;
      const octave = Math.floor(roundedMidi / 12) - 1;
      const noteName = NOTE_NAMES[noteIndex];
      const frequency = 440 * Math.pow(2, (roundedMidi - 69) / 12);

      result.push({
        ...rangeNotes[i],
        frequency,
        noteIndex,
        octave,
        noteName,
      });
    }

    return result;
  }, [rangeNotes]);

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

  // Active scale estimation source
  // "tuner" -> Live pitch history (from NoteEvents on Tuner tab)
  // "manual" -> Manual key override picker
  // "range" -> Range test analysis results (from RangeNotes on Range tab)
  const [scaleSource, setScaleSource] = React.useState<"tuner" | "manual" | "range">("tuner");

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

    const candidates = getKeyCorrelations(counts);
    if (candidates.length === 0) return null;

    const primary = candidates[0];
    const alternate = candidates[1] || primary;

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
      candidates,
    };
  }, [noteEvents]);

  // Compute key estimate from Vocal Range notes
  const rangeEstimatedKey = React.useMemo(() => {
    if (smoothedRangeNotes.length === 0) {
      return null;
    }

    const rangeCounts = new Array(12).fill(0);
    smoothedRangeNotes.forEach((rn) => {
      const idx = NOTE_NAMES.findIndex(name => name.toLowerCase() === rn.noteName.toLowerCase());
      if (idx !== -1) {
        rangeCounts[idx] += rn.confidence || 1.0;
      }
    });

    const candidates = getKeyCorrelations(rangeCounts);
    if (candidates.length === 0) return null;

    const primary = candidates[0];
    const alternate = candidates[1] || primary;

    let confidenceRating: "High" | "Medium" | "Low" = "Low";
    if (primary.correlation > 0.6) {
      confidenceRating = "High";
    } else if (primary.correlation > 0.4) {
      confidenceRating = "Medium";
    }

    return {
      primaryName: primary.name,
      primaryIndex: primary.keyIndex,
      isMajor: primary.isMajor,
      confidence: confidenceRating,
      alternateName: alternate.name,
      correlation: primary.correlation,
      candidates,
    };
  }, [smoothedRangeNotes]);

  // Manual scale override states
  const [manualKeyIndex, setManualKeyIndex] = React.useState<number | null>(null);
  const [manualIsMajor, setManualIsMajor] = React.useState<boolean>(true);

  // High quality derived key model representing active target scale
  const activeKeyInfo = React.useMemo(() => {
    if (scaleSource === "manual" && manualKeyIndex !== null) {
      const name = NOTE_NAMES[manualKeyIndex] + (manualIsMajor ? " Major" : " Minor");
      const altIdx = (manualKeyIndex + 9) % 12; // relative minor or major conversion
      const alternateName = NOTE_NAMES[altIdx] + (manualIsMajor ? " Minor" : " Major");
      return {
        primaryName: name,
        primaryIndex: manualKeyIndex,
        isMajor: manualIsMajor,
        confidence: "High" as const,
        alternateName: alternateName,
        correlation: 1.0,
        isManual: true,
        source: "manual",
      };
    }
    
    if (scaleSource === "range") {
      if (rangeEstimatedKey) {
        return {
          primaryName: rangeEstimatedKey.primaryName,
          primaryIndex: rangeEstimatedKey.primaryIndex,
          isMajor: rangeEstimatedKey.isMajor,
          confidence: rangeEstimatedKey.confidence,
          alternateName: rangeEstimatedKey.alternateName,
          correlation: rangeEstimatedKey.correlation,
          isManual: false,
          isRange: true,
          source: "range",
        };
      }
    }

    // Default or fallback to tuner
    if (estimatedKey) {
      return {
        ...estimatedKey,
        isManual: false,
        source: "tuner",
      };
    }

    // Return standard fallback (C Major) so chord lists are pre-filled safely
    return {
      primaryName: "C Major",
      primaryIndex: 0,
      isMajor: true,
      confidence: "High" as const,
      alternateName: "A Minor",
      correlation: 1.0,
      isManual: false,
      isDefault: true,
      source: "tuner",
    };
  }, [scaleSource, manualKeyIndex, manualIsMajor, estimatedKey, rangeEstimatedKey]);

  // Chord progression & Transpose configuration
  const [chordComplexity, setChordComplexity] = React.useState<"Simple" | "Rich" | "Bollywoodish">("Bollywoodish");
  const [selectedCapoOption, setSelectedCapoOption] = React.useState<CapoOption | null>(null);
  const [selectedChordName, setSelectedChordName] = React.useState<string | null>(null);

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
  const activeKeyIndex = activeKeyInfo.primaryIndex;
  const activeIsMajor = activeKeyInfo.isMajor;

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
    if (smoothedRangeNotes.length === 0) return null;

    let lowest = smoothedRangeNotes[0];
    let highest = smoothedRangeNotes[0];
    let minMidi = (lowest.octave + 1) * 12 + lowest.noteIndex;
    let maxMidi = (highest.octave + 1) * 12 + highest.noteIndex;

    smoothedRangeNotes.forEach((note) => {
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

    // Scale notes of current key using the smoothed notes for precision accuracy
    let inKeyCount = 0;
    const scaleDegrees = activeKeyInfo 
      ? getScaleNotes(activeKeyInfo.primaryIndex, activeKeyInfo.isMajor)
      : [];

    smoothedRangeNotes.forEach((note) => {
      if (scaleDegrees.length === 0 || scaleDegrees.includes(note.noteIndex)) {
        inKeyCount++;
      }
    });

    const inKeyPercentage = Math.round((inKeyCount / smoothedRangeNotes.length) * 100);
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
  }, [smoothedRangeNotes, rangeNotes.length, activeKeyInfo]);

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
          estimatedKey: activeKeyInfo ? activeKeyInfo.primaryName : "Unknown Key",
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
    if (!activeKeyInfo || originalProgressionChords.length === 0) return;
    try {
      setLoadingExplanation(true);
      setExplanation(null);

      if (!navigator.onLine) {
        // Instantly generate and assign the local offline theory lesson
        const localLesson = generateLocalOfflineTheory(activeKeyInfo.primaryName, activeKeyInfo.isMajor);
        setExplanation(localLesson);
        return;
      }

      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: activeKeyInfo.primaryName,
          alternateKey: activeKeyInfo.alternateName,
          mode: activeKeyInfo.isMajor ? "major" : "minor",
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
      const localLesson = generateLocalOfflineTheory(activeKeyInfo.primaryName, activeKeyInfo.isMajor);
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
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none pb-[calc(6rem+env(safe-area-inset-bottom,0px))] p-3 space-y-3" id="main-viewport">
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
                  
                  {/* SCALE NAVIGATOR & MANUAL CAPTURE */}
                  <div className="bg-[#101216] border border-[#2A2D35]/50 rounded-xl p-3 space-y-3">
                    
                    <div className="flex justify-between items-center pb-2 border-b border-[#2A2D35]/30">
                      <div className="flex items-center gap-1.5">
                        <Music className="w-3.5 h-3.5 text-[#F27D26]" />
                        <span className="text-[10px] font-black uppercase text-white/95 tracking-wide">
                          Scale Target Navigator
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 bg-[#171920] border border-[#2A2D35]/40 px-1.5 py-0.5 rounded-full select-none">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          scaleSource === "manual" ? "bg-amber-400" : scaleSource === "range" ? "bg-[#F27D26]" : "bg-[#00FF41] animate-pulse"
                        }`} />
                        <span className="text-[7.5px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                          {scaleSource === "manual" ? "Keyboard Select" : scaleSource === "range" ? "Vocal Range Source" : "🎤 Vocal Live"}
                        </span>
                      </div>
                    </div>

                    {/* SCALE SOURCE SELECTION BAR */}
                    <div className="flex bg-[#0A0C0F] p-0.5 border border-[#2A2D35]/50 rounded-lg font-mono text-[8px] uppercase font-bold w-full select-none">
                      <button
                        onClick={() => {
                          setScaleSource("tuner");
                          setSelectedCapoOption(null);
                        }}
                        className={`flex-1 text-center py-1 rounded transition-all cursor-pointer ${
                          scaleSource === "tuner" ? "bg-[#00FF41] text-black font-extrabold" : "text-white/40 hover:text-white"
                        }`}
                      >
                        🎤 Vocal Live
                      </button>
                      <button
                        onClick={() => {
                          setScaleSource("manual");
                          if (manualKeyIndex === null) {
                            setManualKeyIndex(0);
                          }
                          setSelectedCapoOption(null);
                        }}
                        className={`flex-1 text-center py-1 rounded transition-all cursor-pointer ${
                          scaleSource === "manual" ? "bg-amber-400 text-black font-extrabold" : "text-white/40 hover:text-white"
                        }`}
                      >
                        ⌨️ Pick Key
                      </button>
                      <button
                        onClick={() => {
                          setScaleSource("range");
                          setSelectedCapoOption(null);
                        }}
                        className={`flex-1 text-center py-1 rounded transition-all cursor-pointer ${
                          scaleSource === "range" ? "bg-[#F27D26] text-black font-extrabold" : "text-white/40 hover:text-white"
                        }`}
                      >
                        📈 Range Scan
                      </button>
                    </div>

                    {/* CURRENT ACTIVE SCALE INFOBAR */}
                    <div className="flex items-center justify-between text-[11px] bg-[#16181F] p-2 rounded-lg border border-[#2A2D35]/40 shadow-inner">
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-400 font-medium text-[10px]">Active Scale:</span>
                        <span className="text-[#F27D26] font-black text-xs px-2.5 py-0.5 rounded bg-[#0A0B0E] border border-[#2A2D35]/30 inline-block">
                          {formatFlatName(activeKeyInfo.primaryName)}
                        </span>
                      </div>
                      
                      {scaleSource !== "tuner" && (
                        <button
                          onClick={() => {
                            setScaleSource("tuner");
                            setManualKeyIndex(null);
                            setSelectedCapoOption(null);
                          }}
                          className="text-[8px] font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/20 transition-all"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          Live Vocal
                        </button>
                      )}
                    </div>

                    {/* RENDER BASED ON ACTIVE OPTION (LAST OPTION IS RANGE AND IT SHOWS RANGE TEST ANALYSIS) */}
                    {scaleSource === "range" ? (
                      <div className="bg-[#0F1115] border border-[#2A2D35]/65 rounded-xl p-3 space-y-2.5 text-left transition-all duration-200">
                        <div className="flex justify-between items-center pb-2 border-b border-[#2A2D35]/30">
                          <span className="text-[9px] font-black text-[#F27D26] uppercase tracking-wider">
                            Range Test Analysis Report
                          </span>
                          <span className="text-[7.5px] font-mono text-[#00FF41] bg-[#00FF41]/10 border border-[#00FF41]/20 px-1.5 py-0.5 rounded uppercase">
                            {sessionReport ? "Analysis active" : "No Scan Data"}
                          </span>
                        </div>

                        {sessionReport ? (
                          <div className="space-y-2.5">
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div className="bg-[#15171C]/90 border border-[#2A2D35]/50 p-2 rounded-lg text-center">
                                <span className="text-[7.5px] font-mono text-zinc-550 uppercase tracking-widest block mb-0.5">Vocal Range Limit</span>
                                <span className="text-xs font-black text-white font-mono">
                                  {sessionReport.lowest.noteName}{sessionReport.lowest.octave} - {sessionReport.highest.noteName}{sessionReport.highest.octave}
                                </span>
                              </div>
                              
                              <div className="bg-[#15171C]/90 border border-[#2A2D35]/50 p-2 rounded-lg text-center">
                                <span className="text-[7.5px] font-mono text-zinc-550 uppercase tracking-widest block mb-0.5">Voice Type</span>
                                <span className="text-xs font-black text-amber-500 font-sans uppercase">
                                  {sessionReport.classification}
                                </span>
                              </div>
                            </div>

                            <div className="bg-[#141210] border border-[#F27D26]/10 p-2.5 rounded-lg text-[9.5px] leading-relaxed text-[#FFF]/80">
                              <div className="text-[8.5px] font-mono font-bold text-[#F27D26] uppercase mb-0.5">Scale Match Alignment</div>
                              <div>
                                We analyzed your register pitch distribution and estimated your vocal center at <span className="text-white font-black">{formatFlatName(activeKeyInfo.primaryName)}</span> with a <span className="text-[#00FF41] font-black">{sessionReport.inKeyPercentage}% key harmony alignment score</span>.
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="py-4 text-center space-y-2 text-[10.5px]">
                            <p className="text-zinc-550 leading-relaxed max-w-[220px] mx-auto">
                              You haven&apos;t run a range scan session yet or have no vocal registers recorded.
                            </p>
                            <button
                              onClick={() => setActiveTab("range")}
                              className="px-3.5 py-1.5 bg-[#F27D26]/10 hover:bg-[#F27D26]/20 border border-[#F27D26]/30 text-[#F27D26] text-[8.5px] uppercase font-bold tracking-wider rounded-lg cursor-pointer transition-all"
                            >
                              Go Run Vocal Range Scan
                            </button>
                          </div>
                        )}
                      </div>
                    ) : scaleSource === "manual" ? (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block">
                          Tap any key to manual override:
                        </span>
                        
                        <div className="grid grid-cols-6 gap-1">
                          {NOTE_NAMES.map((name, idx) => {
                            const isCurrentlySelected = manualKeyIndex === idx;
                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  setManualKeyIndex(idx);
                                  setSelectedCapoOption(null);
                                }}
                                className={`py-1 text-[10px] font-mono font-black rounded-lg transition-all border cursor-pointer ${
                                  isCurrentlySelected
                                    ? "bg-[#1E110A] text-[#F27D26] border-[#F27D26]/60 shadow-[#F27D26]/5"
                                    : "bg-[#111317] text-zinc-400 border-zinc-900/40 hover:border-zinc-700 hover:text-white"
                                }`}
                              >
                                {formatFlatName(name)}
                              </button>
                            );
                          })}
                        </div>

                        {/* Major / Minor type toggles */}
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <button
                            onClick={() => {
                              setManualIsMajor(true);
                              setSelectedCapoOption(null);
                            }}
                            className={`py-1 text-[9px] font-black uppercase tracking-wide rounded-lg border transition-all cursor-pointer ${
                              manualIsMajor
                                ? "bg-[#F27D26]/10 text-[#F27D26] border-[#F27D26]/30 font-black shadow-inner"
                                : "bg-[#111317] text-zinc-550 border-transparent hover:text-zinc-350"
                            }`}
                          >
                            Bright Major Scale
                          </button>
                          <button
                            onClick={() => {
                              setManualIsMajor(false);
                              setSelectedCapoOption(null);
                            }}
                            className={`py-1 text-[9px] font-black uppercase tracking-wide rounded-lg border transition-all cursor-pointer ${
                              !manualIsMajor
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/30 font-black shadow-inner"
                                : "bg-[#111317] text-zinc-550 border-transparent hover:text-zinc-350"
                            }`}
                          >
                            Warm Minor Scale
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* LIVE VOCAL LIVE PITCH INFO */
                      <div className="bg-[#0D0E11] border border-[#2A2D35]/30 rounded-lg p-2.5 text-left text-[10px]">
                        <span className="text-[7.5px] font-mono text-zinc-500 uppercase tracking-widest block mb-1">
                          Microphone Live Capture Status
                        </span>
                        {estimatedKey ? (
                          <p className="text-zinc-350 leading-snug">
                            Vocal core mapping completed! Singing centered in <b className="text-white">{formatFlatName(estimatedKey.primaryName)}</b>, with {estimatedKey.confidence} confidence rating. We captured {noteEvents.length} notes successfully.
                          </p>
                        ) : (
                          <p className="text-zinc-500 leading-snug">
                            No vocal core captured yet. Go to the <button onClick={() => setActiveTab("tuner")} className="text-[#F27D26] font-bold hover:underline cursor-pointer">Tuner</button> tab and hum/sing notes to dynamically construct your singing scale structure!
                          </p>
                        )}
                      </div>
                    )}

                    {/* SUCCEEDED IN SCALBILITY CAPTURE: DISPLAY ALL DETECTED SCALES */}
                    {(() => {
                      const activeCandidates = scaleSource === "range" 
                        ? rangeEstimatedKey?.candidates 
                        : estimatedKey?.candidates;

                      if (!activeCandidates || activeCandidates.length === 0) return null;

                      // Slice top 12 possible matches
                      const topCandidates = activeCandidates.slice(0, 12);

                      return (
                        <div className="pt-2.5 border-t border-[#2A2D35]/35 space-y-2 text-left">
                          <div className="flex justify-between items-center text-[8px] font-mono uppercase tracking-widest">
                            <span className="text-white/40">Captured Matched Scales (Tap to Apply)</span>
                            <span className="text-[#F27D26] animate-pulse">Select dynamic scale</span>
                          </div>

                          <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
                            {topCandidates.map((cand, cIdx) => {
                              const isScaleSelected = scaleSource === "manual" && manualKeyIndex === cand.keyIndex && manualIsMajor === cand.isMajor;
                              return (
                                <button
                                  key={cIdx}
                                  onClick={() => {
                                    setManualKeyIndex(cand.keyIndex);
                                    setManualIsMajor(cand.isMajor);
                                    setScaleSource("manual");
                                    setSelectedCapoOption(null);
                                  }}
                                  className={`py-1.5 px-2.5 rounded-lg shrink-0 text-left border cursor-pointer select-none transition-all flex flex-col justify-between min-w-[85px] ${
                                    isScaleSelected
                                      ? "bg-[#1E110A] border-[#F27D26]/70 text-[#F27D26]"
                                      : "bg-[#090B0D] border-[#202229] text-zinc-400 hover:border-zinc-700 hover:text-white"
                                  }`}
                                >
                                  <span className="text-[10px] font-mono font-black truncate max-w-[75px] block">
                                    {formatFlatName(cand.name.split(" ")[0])}
                                    <span className="text-[8px] font-normal opacity-70 block">
                                      {cand.isMajor ? "Major" : "Minor"}
                                    </span>
                                  </span>
                                  <span className={`text-[8.5px] font-mono font-bold mt-1 block ${
                                    cand.matchPercentage > 75 
                                      ? "text-[#00FF41]" 
                                      : cand.matchPercentage > 45 
                                        ? "text-[#F27D26]" 
                                        : "text-zinc-600"
                                  }`}>
                                    {cand.matchPercentage}% match
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                  </div>

                  <div className="flex flex-col gap-2 pt-1 border-t border-[#2A2D35]/30">
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
                  {(() => {
                    const activeChordsList = (selectedCapoOption ? selectedCapoOption.chords : suggestedProgressions[0]?.chords || []).slice(0, 4);
                    const currentSelectedChord = selectedChordName && activeChordsList.includes(selectedChordName) 
                      ? selectedChordName 
                      : activeChordsList[0] || null;

                    return (
                      <div className="space-y-3 pt-1">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[8px] font-mono uppercase tracking-wider">
                            <span className="text-white/30">Chord Fingering Previews (Tap to Inspect)</span>
                            <span className="text-[#F27D26] animate-pulse">Select Any Chord Below</span>
                          </div>
                          <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-none">
                            {activeChordsList.map((ch, cIdx) => (
                              <div key={cIdx} className="shrink-0 flex items-center">
                                <GuitarChordDiagram 
                                  chordName={ch} 
                                  isSelected={ch === currentSelectedChord}
                                  onClick={() => setSelectedChordName(ch)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Interactive Beginner Fingering Guide */}
                        {currentSelectedChord && (() => {
                          const guide = getBeginnerChordGuide(currentSelectedChord);
                          if (!guide) return null;
                          return (
                            <div className="bg-[#0D0F12] border border-[#2D2A35]/30 p-3 rounded-xl space-y-2.5 text-left transition-all duration-150">
                              <div className="flex justify-between items-center pb-1.5 border-b border-[#2A2D35]/30">
                                <span className="text-[10px] font-black text-[#F27D26] uppercase font-sans tracking-wider">
                                  {formatFlatName(currentSelectedChord)} Beginner Fingering Coach
                                </span>
                                <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest">
                                  Finger Position Guide
                                </span>
                              </div>
                              
                              <div className="space-y-1.5">
                                {guide.steps.map((step, idx) => {
                                  const isMute = step.includes("Mute");
                                  const isOpen = step.includes("Leave Open");
                                  const parts = step.split(" — ");
                                  const stringLabel = parts[0];
                                  const instructionText = parts[1];

                                  return (
                                    <div key={idx} className="flex gap-2.5 text-[10px] items-start text-zinc-350 leading-tight">
                                      <span className={`font-mono text-[9px] px-1.5 py-0.5 font-bold rounded shrink-0 min-w-[20px] text-center ${
                                        isMute 
                                          ? "bg-red-500/15 text-red-400 border border-red-500/10" 
                                          : isOpen 
                                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/10" 
                                            : "bg-amber-500/15 text-[#fbbf24] border border-amber-500/10"
                                      }`}>
                                        {6 - idx}
                                      </span>
                                      <span className="text-zinc-400 font-medium">
                                        <b className="text-zinc-200">{stringLabel}</b> — {instructionText}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="pt-2 border-t border-[#2A2D35]/35 text-[9.5px] italic text-zinc-400 leading-snug flex gap-2 items-start bg-[#16120E]/50 p-2 rounded-lg border border-[#F27D26]/5">
                                <span className="text-[#F27D26] font-bold font-mono shrink-0">💡 PRO TIP:</span>
                                <span>{guide.tip}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}

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
                      <div className="space-y-2">
                        <p className="text-zinc-300 font-semibold text-xs leading-snug">Sing to map lowest/highest registers.</p>
                        <p className="text-[10px] text-zinc-500 leading-snug font-sans">
                          A high-resolution scanning test. Sing your absolute lowest chest note then slide up to your highest head register.
                        </p>
                        <div className="flex items-center gap-1.5 pt-1.5 border-t border-[#2A2D35]/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                          <span className="text-[8px] text-zinc-400 font-mono uppercase tracking-widest">
                            Rolling raw filter handles/shields vocal cracks
                          </span>
                        </div>
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
                        <span className="text-[7.5px] text-blue-400 font-mono uppercase tracking-wide block mt-1">
                          ⚡ 5-Note Rolling Average Smoothing Active
                        </span>
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
              className="absolute bottom-[calc(4.5rem+16px+env(safe-area-inset-bottom,0px))] left-3.5 right-3.5 bg-[#1C110C]/95 border border-amber-500/25 backdrop-blur-md px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-1.5 z-40 shadow-lg shadow-black/40"
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
        <nav className="absolute bottom-0 left-0 right-0 h-[calc(4.5rem+env(safe-area-inset-bottom,0px))] bg-[#12141A]/95 backdrop-blur-md border-t border-[#2A2D35]/50 flex items-center justify-around z-45 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] select-none">
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
          <div className="absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 h-0.5 bg-zinc-950/45 z-30">
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
