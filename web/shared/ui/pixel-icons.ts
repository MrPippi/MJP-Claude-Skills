/**
 * Hand-drawn pixel icons in the spirit of Minecraft items. Each icon is a grid of
 * single-character cells ('.' = transparent) plus a palette. Rendered by PixelIcon.
 * Real in-game textures can replace these via config/mc-assets.ts.
 */
export interface PixelIconData {
  palette: Readonly<Record<string, string>>;
  rows: readonly string[];
}

const grass: PixelIconData = {
  palette: { G: '#6BAA3C', g: '#4E8A2A', d: '#8B5A2B', D: '#6B4220' },
  rows: [
    'GGGGGGGGGGGGGGGG',
    'GgGGGGgGGGGGgGGG',
    'GGGgGGGGGgGGGGgG',
    'GdGGgdGGGdGGdGGg',
    'dDdGddDdGdDddGdD',
    'ddDdddddDdddDddd',
    'dDdddDdddddDdddd',
    'ddddDdddDddddDdd',
    'dddddddddddddddd',
    'dDddddDdddDddddD',
    'ddddDddddddddDdd',
    'ddDddddDddDddddd',
    'dddddddddddddddd',
    'dDdddDddddddDddd',
    'ddddddddDddddddD',
    'dddDddddddDddddd',
  ],
};

const pickaxe: PixelIconData = {
  palette: { C: '#9AA3A8', c: '#6D757A', H: '#8A5A2E', h: '#5A3A1E' },
  rows: [
    '................',
    '....CCCCCCC.....',
    '..CCcccccccCC...',
    '.Cc.......HCCC..',
    '.C.......HH.CCc.',
    '.........HH..Cc.',
    '........HH....C.',
    '.......HH.......',
    '......HH........',
    '.....HH.........',
    '....HH..........',
    '...HH...........',
    '..HH............',
    '.hh.............',
    '................',
    '................',
  ],
};

const redstone: PixelIconData = {
  palette: { R: '#A81E14', r: '#FF4A3A' },
  rows: [
    '................',
    '......RR........',
    '.....RrrR...R...',
    '......RR...RrR..',
    '..R.........R...',
    '.RrR...RRR......',
    '..R...RrrrR.....',
    '......RrrrR..R..',
    '.......RRR..RrR.',
    '..RR.........R..',
    '.RrrR...........',
    '..RR.....RR.....',
    '........RrrR....',
    '...R.....RR.....',
    '..RrR...........',
    '...R............',
  ],
};

const emerald: PixelIconData = {
  palette: { E: '#17693A', e: '#3FD07A', W: '#C8FFE0' },
  rows: [
    '................',
    '................',
    '......EEEE......',
    '.....EeeeeE.....',
    '....EeWeeeeE....',
    '...EeWeeeeeeE...',
    '..EeeeeeeeeeeE..',
    '..EeeeeeeeeeeE..',
    '..EEeeeeeeeeEE..',
    '...EEeeeeeeEE...',
    '....EEeeeeEE....',
    '.....EEeeEE.....',
    '......EEEE......',
    '.......EE.......',
    '................',
    '................',
  ],
};

const book: PixelIconData = {
  palette: { K: '#4A2614', b: '#8B4A2B', Y: '#E8C35A', P: '#F2EBD9' },
  rows: [
    '................',
    '..KKKKKKKKKK....',
    '..KbbbbbbbbbK...',
    '..KbbbbbbbbbK...',
    '..KbbYYYYbbbK...',
    '..KbbbbbbbbbK...',
    '..KbbbbbbbbbK...',
    '..KbbbbbbbbbK...',
    '..KbbbbbbbbbK...',
    '..KbbbbbbbbbK...',
    '..KbbbbbbbbbK...',
    '..KbbbbbbbbbKP..',
    '..KPPPPPPPPPPP..',
    '...KKKKKKKKKKK..',
    '................',
    '................',
  ],
};

const chest: PixelIconData = {
  palette: { W: '#5A3A1E', w: '#A0692E', L: '#D8D8D8' },
  rows: [
    '................',
    '................',
    '.WWWWWWWWWWWWWW.',
    '.WwwwwwwwwwwwwW.',
    '.WwwwwwwwwwwwwW.',
    '.WwwwwwwwwwwwwW.',
    '.WWWWWWLLWWWWWW.',
    '.WwwwwwLLwwwwwW.',
    '.WwwwwwwwwwwwwW.',
    '.WwwwwwwwwwwwwW.',
    '.WwwwwwwwwwwwwW.',
    '.WwwwwwwwwwwwwW.',
    '.WwwwwwwwwwwwwW.',
    '.WWWWWWWWWWWWWW.',
    '................',
    '................',
  ],
};

const sword: PixelIconData = {
  palette: { S: '#8F969B', s: '#E6EEF2', G: '#6B4A22', H: '#8A5A2E', h: '#3A2A14' },
  rows: [
    '................',
    '.............SS.',
    '............SsS.',
    '...........SsS..',
    '..........SsS...',
    '.........SsS....',
    '........SsS.....',
    '...G...SsS......',
    '....G.SsS.......',
    '.....GsS........',
    '......GG........',
    '.....HHGG.......',
    '....HH...G......',
    '...HH...........',
    '..hh............',
    '................',
  ],
};

const command: PixelIconData = {
  palette: { O: '#8A5A2B', o: '#C98A4B', K: '#2A2A2A', k: '#3A3A3A', G: '#E8E8E8' },
  rows: [
    'OOOOOOOOOOOOOOOO',
    'OooooooooooooooO',
    'OoKKKKKKKKKKKKoO',
    'OoKkkkkkkkkkkKoO',
    'OoKkGkkkkkkkkKoO',
    'OoKkkGkkkkkkkKoO',
    'OoKkGkkkkkkkkKoO',
    'OoKkkkkGGGkkkKoO',
    'OoKkkkkkkkkkkKoO',
    'OoKKKKKKKKKKKKoO',
    'OooooooooooooooO',
    'OooOOooOOooOOooO',
    'OooooooooooooooO',
    'OooooooooooooooO',
    'OooooooooooooooO',
    'OOOOOOOOOOOOOOOO',
  ],
};

const pearl: PixelIconData = {
  palette: { P: '#0B4D4A', p: '#2BA89A', q: '#1D7A72', D: '#0A2E2C', W: '#B8FFF3' },
  rows: [
    '................',
    '................',
    '.....PPPPPP.....',
    '....PppppppP....',
    '...PpWWppppqP...',
    '...PpWppppqqP...',
    '...PppppDDqqP...',
    '...PpppDDDqqP...',
    '...PpppDDqqqP...',
    '...PppqqqqqqP...',
    '....PqqqqqqP....',
    '.....PPPPPP.....',
    '................',
    '................',
    '................',
    '................',
  ],
};

const egg: PixelIconData = {
  palette: { E: '#2F5E1E', e: '#5DAA3A', S: '#1E3A12' },
  rows: [
    '................',
    '......EEEE......',
    '.....EeeeeE.....',
    '....EeeSeeeE....',
    '....EeeeeeeE....',
    '...EeSeeeeSeE...',
    '...EeeeeeeeeE...',
    '...EeeeSeeeeE...',
    '...EeeeeeeeSE...',
    '...ESeeeeeeeE...',
    '...EeeeeSeeeE...',
    '....EeeeeeeE....',
    '.....EEEEEE.....',
    '................',
    '................',
    '................',
  ],
};

const head: PixelIconData = {
  palette: { H: '#3B2A1A', s: '#C69C6D', w: '#FFFFFF', b: '#4A5FC1', n: '#8A5A3C', m: '#6B3A24' },
  rows: ['HHHHHHHH', 'HHHHHHHH', 'HssssssH', 'ssssssss', 'swbssbws', 'sssnnsss', 'ssmmmmss', 'ssssssss'],
};

const sign: PixelIconData = {
  palette: { W: '#6B4A22', w: '#C9A063', K: '#3A2A14', P: '#5A3A1E' },
  rows: [
    '................',
    '................',
    '.WWWWWWWWWWWWWW.',
    '.WwwwwwwwwwwwwW.',
    '.WwKKKKKKKKKwwW.',
    '.WwwwwwwwwwwwwW.',
    '.WwKKKKKKwwwwwW.',
    '.WwwwwwwwwwwwwW.',
    '.WwKKKKKKKKwwwW.',
    '.WwwwwwwwwwwwwW.',
    '.WWWWWWWWWWWWWW.',
    '.......PP.......',
    '.......PP.......',
    '.......PP.......',
    '.......PP.......',
    '................',
  ],
};

const creeper: PixelIconData = {
  palette: { G: '#5DAA3A', g: '#4E8A2A', K: '#1A1A1A' },
  rows: ['GgGGGgGG', 'GGGgGGGg', 'GKKGgKKG', 'GKKGGKKG', 'gGGKKGGG', 'GGKKKKgG', 'GgKKKKGG', 'GGKGGKGg'],
};

export const PIXEL_ICONS = {
  grass,
  pickaxe,
  redstone,
  emerald,
  book,
  chest,
  sword,
  command,
  pearl,
  egg,
  head,
  sign,
  creeper,
} as const satisfies Record<string, PixelIconData>;

export type PixelIconName = keyof typeof PIXEL_ICONS;

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  color: string;
}

/** Collapses horizontal runs of the same colour into single rects (fewer DOM nodes). */
export function toRects(icon: PixelIconData): PixelRect[] {
  return icon.rows.flatMap((row, y) => {
    const rects: PixelRect[] = [];
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end += 1;
      const color = icon.palette[ch];
      if (ch !== '.' && color) rects.push({ x, y, w: end - x, color });
      x = end;
    }
    return rects;
  });
}
