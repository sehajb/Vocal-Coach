// Music theory and chord shape engine for Vocal Key & Guitar Coach

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const FLAT_DISPLAY_NAMES: Record<string, string> = {
  "C#": "Db",
  "D#": "Eb",
  "F#": "Gb",
  "G#": "Ab",
  "A#": "Bb"
};

// Hardcoded guitar shapes: strings are ordered 6 to 1 (left to right: E A D G B e)
// 'x' means muted, '0' means open, numbers represent frets
export const CHORD_SHAPES: Record<string, { frets: string; fingers?: string }> = {
  // C Chords
  "C": { frets: "x32010" },
  "Cmaj7": { frets: "x32000" },
  "C7": { frets: "x32310" },
  "Csus2": { frets: "x30030" },
  "Csus4": { frets: "x33013" },
  "Cadd9": { frets: "x32030" },
  "Cm": { frets: "x35543" },
  "Cm7": { frets: "x35343" },
  "Cdim": { frets: "x3454x" },
  "C#dim": { frets: "x4565x" },
  
  // C# Chords
  "C#": { frets: "x46664" },
  "C#maj7": { frets: "x46564" },
  "C#7": { frets: "x46464" },
  "C#sus2": { frets: "x46644" },
  "C#add9": { frets: "x4664x" },
  "C#m": { frets: "x46654" },
  "C#m7": { frets: "x46454" },

  // D Chords
  "D": { frets: "xx0232" },
  "Dmaj7": { frets: "xx0222" },
  "D7": { frets: "xx0212" },
  "Dsus2": { frets: "xx0230" },
  "Dsus4": { frets: "xx0233" },
  "Dadd9": { frets: "xx0252" },
  "Dm": { frets: "xx0231" },
  "Dm7": { frets: "xx0211" },
  "Ddim": { frets: "xx0101" },
  "D#dim": { frets: "xx1212" },

  // D# Chords
  "D#": { frets: "x68886" },
  "D#maj7": { frets: "x68786" },
  "D#7": { frets: "x68686" },
  "D#sus2": { frets: "x68866" },
  "D#m": { frets: "x68876" },
  "D#m7": { frets: "x68676" },
  
  // E Chords
  "E": { frets: "022100" },
  "Emaj7": { frets: "021100" },
  "E7": { frets: "020100" },
  "Esus2": { frets: "799877" },
  "Esus4": { frets: "022200" },
  "Eadd9": { frets: "024100" },
  "Em": { frets: "022000" },
  "Em7": { frets: "020000" },
  "Edim": { frets: "xx2323" },
  "Fdim": { frets: "xx3434" },

  // F Chords
  "F": { frets: "133211" },
  "Fmaj7": { frets: "x33210" },
  "F7": { frets: "131211" },
  "Fsus2": { frets: "x33011" },
  "Fsus4": { frets: "133311" },
  "Fadd9": { frets: "133011" },
  "Fm": { frets: "133111" },
  "Fm7": { frets: "131111" },
  "F#dim": { frets: "xx4545" },

  // F# Chords
  "F#": { frets: "244322" },
  "F#maj7": { frets: "243322" },
  "F#7": { frets: "242322" },
  "F#sus2": { frets: "244122" },
  "F#m": { frets: "244222" },
  "F#m7": { frets: "242222" },
  "Gdim": { frets: "xx5655" },

  // G Chords
  "G": { frets: "320003" },
  "Gmaj7": { frets: "320002" },
  "G7": { frets: "320001" },
  "Gsus2": { frets: "300033" },
  "Gsus4": { frets: "320013" },
  "Gadd9": { frets: "320203" },
  "Gm": { frets: "355333" },
  "Gm7": { frets: "353333" },
  "G#dim": { frets: "xx6767" },

  // G# Chords
  "G#": { frets: "466544" },
  "G#maj7": { frets: "465544" },
  "G#7": { frets: "464544" },
  "G#sus2": { frets: "466344" },
  "G#m": { frets: "466444" },
  "G#m7": { frets: "464444" },
  "Adim": { frets: "xx7877" },

  // A Chords
  "A": { frets: "x02220" },
  "Amaj7": { frets: "x02120" },
  "A7": { frets: "x02020" },
  "Asus2": { frets: "x02200" },
  "Asus4": { frets: "x02230" },
  "Aadd9": { frets: "x02420" },
  "Am": { frets: "x02210" },
  "Am7": { frets: "x02010" },
  "A#dim": { frets: "xx2323" },

  // A# Chords
  "A#": { frets: "x13331" },
  "A#maj7": { frets: "x13231" },
  "A#7": { frets: "x13131" },
  "A#sus2": { frets: "x13311" },
  "A#m": { frets: "x13321" },
  "A#m7": { frets: "x13121" },
  "Bdim": { frets: "xx3434" },

  // B Chords
  "B": { frets: "x24442" },
  "Bmaj7": { frets: "x24342" },
  "B7": { frets: "x21202" },
  "Bsus2": { frets: "x24422" },
  "Bsus4": { frets: "x24452" },
  "Bm": { frets: "x24432" },
  "Bm7": { frets: "x24232" },
  
  // Flat aliases mapping back to sharp equivalents
  "Db": { frets: "x46664" },
  "Dbmaj7": { frets: "x46564" },
  "Dbm": { frets: "x46654" },
  "Dbm7": { frets: "x46454" },
  "Eb": { frets: "x68886" },
  "Ebmaj7": { frets: "x68786" },
  "Ebm": { frets: "x68876" },
  "Ebm7": { frets: "x68676" },
  "Gb": { frets: "244322" },
  "Gbmaj7": { frets: "243322" },
  "Gbm": { frets: "244222" },
  "Ab": { frets: "466544" },
  "Abmaj7": { frets: "465544" },
  "Abm": { frets: "466444" },
  "Abm7": { frets: "464444" },
  "Bb": { frets: "x13331" },
  "Bbmaj7": { frets: "x13231" },
  "Bbm": { frets: "x13321" },
  "Bbm7": { frets: "x13121" },
};

// Simple flat to sharp normalizer for database entries
const FLAT_LOOKUP: Record<string, string> = {
  "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#"
};

// Sharps to flats helper
export function formatFlatName(chordOrKey: string): string {
  // Replace components like root note
  let root = "";
  let rest = "";
  if (chordOrKey.length >= 2 && (chordOrKey[1] === "#" || chordOrKey[1] === "b")) {
    root = chordOrKey.substring(0, 2);
    rest = chordOrKey.substring(2);
  } else {
    root = chordOrKey.substring(0, 1);
    rest = chordOrKey.substring(1);
  }
  const flatRoot = FLAT_DISPLAY_NAMES[root] || root;
  return flatRoot + rest;
}

export function transposeChord(chord: string, semitones: number): string {
  let root = "";
  let quality = "";

  if (chord.length >= 2 && (chord[1] === "#" || chord[1] === "b")) {
    root = chord.substring(0, 2);
    quality = chord.substring(2);
  } else {
    root = chord.substring(0, 1);
    quality = chord.substring(1);
  }

  let normalizedRoot = FLAT_LOOKUP[root] || root;
  const idx = NOTE_NAMES.indexOf(normalizedRoot);
  if (idx === -1) return chord;

  const newIdx = (idx + semitones + 120) % 12;
  const newRoot = NOTE_NAMES[newIdx];

  return newRoot + quality;
}

export interface ProgressionInfo {
  name: string;
  chords: string[];
  romanNumerals: string[];
  description: string;
}

// Build chord collections and progressions based on key root and style
export function buildChordsForKey(
  rootIndex: number,
  isMajor: boolean,
  complexity: "Simple" | "Rich" | "Bollywoodish"
): ProgressionInfo[] {
  const rootNote = NOTE_NAMES[rootIndex];

  if (isMajor) {
    // Degrees: I, ii, iii, IV, V, vi, vii°
    const d1 = NOTE_NAMES[rootIndex];
    const d2 = NOTE_NAMES[(rootIndex + 2) % 12];
    const d3 = NOTE_NAMES[(rootIndex + 4) % 12];
    const d4 = NOTE_NAMES[(rootIndex + 5) % 12];
    const d5 = NOTE_NAMES[(rootIndex + 7) % 12];
    const d6 = NOTE_NAMES[(rootIndex + 9) % 12];
    const d7 = NOTE_NAMES[(rootIndex + 11) % 12];

    if (complexity === "Simple") {
      return [
        {
          name: "Pop/Bollywood Anthem Progression",
          chords: [d1, d5, d6 + "m", d4],
          romanNumerals: ["I", "V", "vi", "IV"],
          description: "Used in hundreds of mega-hits globally (e.g., 'Phoolon Ka Taraan Ka', 'Jeene Ke Hain Chaar Din').",
        },
        {
          name: "Classic Sunset Strummer",
          chords: [d1, d4, d5, d1],
          romanNumerals: ["I", "IV", "V", "I"],
          description: "Standard bright resolution. Light, upbeat, and incredibly singer-friendly.",
        }
      ];
    } else if (complexity === "Rich") {
      return [
        {
          name: "Soulful Jazz-Pop Progression",
          chords: [d1 + "maj7", d6 + "m7", d2 + "m7", d5 + "7"],
          romanNumerals: ["Imaj7", "vi7", "ii7", "V7"],
          description: "Adds gorgeous jazz depth. Smooth transition and rich acoustic overtones.",
        },
        {
          name: "Acoustic Horizon Sus",
          chords: [d1 + "sus2", d4 + "add9", d5, d6 + "m"],
          romanNumerals: ["Isus2", "IVadd9", "V", "vi"],
          description: "Modern singer-songwriter style with beautiful, floating suspension rings.",
        }
      ];
    } else {
      // Bollywoodish (Major root)
      // Usually Bollywood leverages relative major/minor or flat degrees
      // e.g., Let's use the Flat VII chord for that heroic, sliding cinematic Bollywood feel (I - bVII - IV - I)
      const flat7Degree = NOTE_NAMES[(rootIndex + 10) % 12];
      return [
        {
          name: "Cinematic Hero's Journey",
          chords: [d1, flat7Degree, d4, d1],
          romanNumerals: ["I", "bVII", "IV", "I"],
          description: "Classic Bollywood epic rock element (e.g., songs like 'Dil Chahta Hai' title track or 'Roobaroo').",
        },
        {
          name: "The Soft Romance Loop",
          chords: [d1, d6 + "m", d2 + "m", d5],
          romanNumerals: ["I", "vi", "ii", "V"],
          description: "The timeless Bollywood romantic standard (e.g., 'Chura Liya Hai Tumne Jo Dil Ko').",
        }
      ];
    }
  } else {
    // Minor Scale
    // Degrees: i, ii°, III, iv, v/V, VI, VII
    const d1 = NOTE_NAMES[rootIndex];
    const d2 = NOTE_NAMES[(rootIndex + 2) % 12];
    const d3 = NOTE_NAMES[(rootIndex + 3) % 12];
    const d4 = NOTE_NAMES[(rootIndex + 5) % 12];
    const d5 = NOTE_NAMES[(rootIndex + 7) % 12];
    const d6 = NOTE_NAMES[(rootIndex + 8) % 12];
    const d7 = NOTE_NAMES[(rootIndex + 10) % 12];

    if (complexity === "Simple") {
      return [
        {
          name: "The Sad-Pop Standard",
          chords: [d1 + "m", d6, d3, d7],
          romanNumerals: ["i", "VI", "III", "VII"],
          description: "The ultimate modern minor anthem structure. Emotional, soaring and super hooky.",
        },
        {
          name: "Classic Ballad Journey",
          chords: [d1 + "m", d4 + "m", d7, d3],
          romanNumerals: ["i", "iv", "VII", "III"],
          description: "Balanced retro minor movement (e.g., 'Kya Hua Tera Wada' style movements).",
        }
      ];
    } else if (complexity === "Rich") {
      return [
        {
          name: "Suspended Dramatic Flow",
          chords: [d1 + "sus2", d6 + "maj7", d3 + "add9", d7 + "7"],
          romanNumerals: ["isus2", "VImaj7", "IIIadd9", "VII7"],
          description: "Adds rich suspended and 7th textures, creating strong tension and lush, echoing waves.",
        },
        {
          name: "Acoustic Rain Loop",
          chords: [d1 + "m7", d4 + "m7", d5 + "m7", d1 + "m"],
          romanNumerals: ["i7", "iv7", "v7", "i"],
          description: "Lofi, mellow, and deeply emotional minor movement.",
        }
      ];
    } else {
      // Bollywoodish (Minor scale!)
      // Bollywoodish minor rules! (i - VI - VII - i) e.g. Aashiqui 2 style, or (i - VII - VI - v) kabira style
      return [
        {
          name: "Aashiqui Romantic Storm",
          chords: [d1 + "m", d6, d7, d1 + "m"],
          romanNumerals: ["i", "VI", "VII", "i"],
          description: "The ultimate dramatic Bollywood romance progression (e.g., 'Tum Hi Ho', 'Sunn Raha Hai Na Tu').",
        },
        {
          name: "Kabira / Pasoori Sufi Loop",
          chords: [d1 + "m", d7, d6, d5 + "m"],
          romanNumerals: ["i", "VII", "VI", "v"],
          description: "Beautiful descending folk/Sufi progression (e.g., 'Kabira', 'Pasoori', 'Laree Choote'). Hits deep Punjabi vibes.",
        }
      ];
    }
  }
}

export interface CapoOption {
  easyKeyName: string;
  capoFret: number;
  romanNumerals: string[];
  chords: string[];
}

export function getCapoSuggestions(
  rootIndex: number,
  isMajor: boolean,
  originalChords: string[]
): CapoOption[] {
  // If no original chords, return empty
  if (!originalChords || originalChords.length === 0) return [];

  // Key names in order to calculate distance
  // Easy keys for Guitarists: 
  // Major: C, D, E, G, A
  // Minor: Am (A minor corresponds to index 9), Em (4), Dm (2)
  const targetKeys = isMajor
    ? [
        { name: "C", index: 0, suffix: "" },
        { name: "D", index: 2, suffix: "" },
        { name: "E", index: 4, suffix: "" },
        { name: "G", index: 7, suffix: "" },
        { name: "A", index: 9, suffix: "" },
      ]
    : [
        { name: "A", index: 9, suffix: "m" },
        { name: "E", index: 4, suffix: "m" },
        { name: "D", index: 2, suffix: "m" },
      ];

  const suggestions: CapoOption[] = [];

  for (const tk of targetKeys) {
    // we want easyKeyIndex + capoFret = originalRootIndex
    // capoFret = (originalRootIndex - easyKeyIndex + 12) % 12
    const capoFret = (rootIndex - tk.index + 12) % 12;

    // Capo fret between 1 and 9 are comfortable on acoustic guitars
    // 0 is excluded because it means no transposition needed (already playing in that key)
    if (capoFret > 0 && capoFret <= 9) {
      // Transpose original chords down by capoFret semitones
      const localChords = originalChords.map((chord) => transposeChord(chord, -capoFret));
      suggestions.push({
        easyKeyName: tk.name + tk.suffix,
        capoFret,
        romanNumerals: [], // Can be filled if needed or left empty
        chords: localChords,
      });
    }
  }

  // Sort primarily by lower capos for finger comfort
  return suggestions.sort((a, b) => a.capoFret - b.capoFret);
}

// Finger configurations for common open chord voicings and standard finger shapes (1=Index, 2=Middle, 3=Ring, 4=Pinky)
export const EXPLICIT_FINGERS: Record<string, string> = {
  // Open C Chords
  "C": "x32010",
  "Cmaj7": "x32000",
  "C7": "x32410",
  "Csus2": "x10030",
  "Csus4": "x23014",
  "Cadd9": "x32040",
  "Cm": "x13421",
  "Cm7": "x13121",
  "Cdim": "x1243x",
  "C#dim": "x1243x",

  // Open D Chords
  "D": "xx0132",
  "Dmaj7": "xx0111",
  "D7": "xx0213",
  "Dsus2": "xx0130",
  "Dsus4": "xx0134",
  "Dadd9": "xx0142",
  "Dm": "xx0231",
  "Dm7": "xx0211",
  "Ddim": "xx0102",
  "D#dim": "xx1213",

  // Open E Chords
  "E": "023100",
  "Emaj7": "021100",
  "E7": "020100",
  "Esus2": "134211",
  "Esus4": "023400",
  "Eadd9": "014200",
  "Em": "023000",
  "Em7": "020000",
  "Edim": "xx1324",
  "Fdim": "xx1324",

  // F Chords
  "F": "134211",
  "Fmaj7": "x34210",
  "F7": "131211",
  "Fsus2": "x34011",
  "Fsus4": "134411",
  "Fadd9": "134011",
  "Fm": "134111",
  "Fm7": "131111",
  "F#dim": "xx1324",

  // F# Chords
  "F#": "134211",
  "F#maj7": "132211",
  "F#7": "131211",
  "F#sus2": "134111",
  "F#m": "134111",
  "F#m7": "131111",
  "Gdim": "xx1324",

  // Open G Chords
  "G": "320004",
  "Gmaj7": "320001",
  "G7": "320001",
  "Gsus2": "300044",
  "Gsus4": "320014",
  "Gadd9": "210304",
  "Gm": "134111",
  "Gm7": "131111",
  "G#dim": "xx1324",

  // G# Chords
  "G#": "134211",
  "G#maj7": "132211",
  "G#7": "131211",
  "G#sus2": "134111",
  "G#m": "134111",
  "G#m7": "131111",
  "Adim": "xx1324",

  // Open A Chords
  "A": "x01230",
  "Amaj7": "x02130",
  "A7": "x02030",
  "Asus2": "x01200",
  "Asus4": "x01230",
  "Aadd9": "x01320",
  "Am": "x02310",
  "Am7": "x02010",
  "A#dim": "xx1324",

  // A# / Bb Chords
  "A#": "x13331",
  "A#maj7": "x13241",
  "A#7": "x13131",
  "A#sus2": "x13411",
  "A#m": "x13421",
  "A#m7": "x13121",
  "Bdim": "xx1324",

  // B Chords
  "B": "x13331",
  "Bmaj7": "x13241",
  "B7": "x21304",
  "Bsus2": "x13411",
  "Bsus4": "x13441",
  "Bm": "x13421",
  "Bm7": "x13121",

  // Flat aliases
  "Db": "x13331",
  "Dbmaj7": "x13241",
  "Dbm": "x13421",
  "Dbm7": "x13121",
  "Eb": "x13331",
  "Ebmaj7": "x13241",
  "Ebm": "x13421",
  "Ebm7": "x13121",
  "Gb": "134211",
  "Gbmaj7": "132211",
  "Gbm": "134111",
  "Ab": "134211",
  "Abmaj7": "132211",
  "Abm": "134111",
  "Abm7": "131111",
  "Bb": "x13331",
  "Bbmaj7": "x13241",
  "Bbm": "x13421",
  "Bbm7": "x13121",
};

// Intelligently lookup finger diagrams or deduce standard barre patterns
export function getFingersForChord(chordName: string, frets: string): string {
  if (EXPLICIT_FINGERS[chordName]) {
    return EXPLICIT_FINGERS[chordName];
  }

  const normalizedName = chordName.replace("Db", "C#")
                                 .replace("Eb", "D#")
                                 .replace("Gb", "F#")
                                 .replace("Ab", "G#")
                                 .replace("Bb", "A#");

  if (EXPLICIT_FINGERS[normalizedName]) {
    return EXPLICIT_FINGERS[normalizedName];
  }

  const fretChars = frets.split("");
  const numericFrets = fretChars.map(c => parseInt(c)).filter(v => !isNaN(v));
  if (numericFrets.length === 0) return frets;

  const minFret = Math.min(...numericFrets.filter(f => f > 0));

  // Pattern A: starts on 6th string, looks like: E A D G B e -> f, f+2, f+2, f+1, f, f
  if (fretChars[0] !== "x" && fretChars[0] !== "0") {
    const f0 = parseInt(fretChars[0]);
    const f1 = parseInt(fretChars[1]);
    const f2 = parseInt(fretChars[2]);
    const f3 = parseInt(fretChars[3]);
    const f4 = parseInt(fretChars[4]);
    const f5 = parseInt(fretChars[5]);

    // Major barre
    if (f1 === f0 + 2 && f2 === f0 + 2 && f3 === f0 + 1 && f4 === f0 && f5 === f0) {
      return "134211";
    }
    // Minor barre
    if (f1 === f0 + 2 && f2 === f0 + 2 && f3 === f0 && f4 === f0 && f5 === f0) {
      return "134111";
    }
  }

  // Pattern B: starts on 5th string (mute 6th), looks like: x, f, f+2, f+2, f+1, f
  if (fretChars[0] === "x" && fretChars[1] !== "x" && fretChars[1] !== "0") {
    const f1 = parseInt(fretChars[1]);
    const f2 = parseInt(fretChars[2]);
    const f3 = parseInt(fretChars[3]);
    const f4 = parseInt(fretChars[4]);
    const f5 = parseInt(fretChars[5]);

    // Minor barre on A string
    if (f2 === f1 + 2 && f3 === f1 + 2 && f4 === f1 + 1 && f5 === f1) {
      return "x13421";
    }
    // Major barre on A string
    if (f2 === f1 + 2 && f3 === f1 + 2 && f4 === f1 + 2 && f5 === f1) {
      return "x13331";
    }
  }

  // Fallback heuristic: map by distance relative to lowest fret
  const result: string[] = [];
  fretChars.forEach((char) => {
    if (char === "x") {
      result.push("x");
    } else if (char === "0") {
      result.push("0");
    } else {
      const fretVal = parseInt(char);
      const diff = fretVal - minFret;
      if (diff === 0) {
        result.push("1");
      } else if (diff === 1) {
        result.push("2");
      } else if (diff === 2) {
        result.push("3");
      } else {
        result.push("4");
      }
    }
  });

  return result.join("");
}

