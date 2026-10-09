import { BLOCK_TEXTURES, HERO_ARTWORK } from '@/config/mc-assets';
import { withBasePath } from '@/config/routes';

/** Scene grid: one 16px block texture spans a 4-unit block. */
const WIDTH = 288;
const HEIGHT = 48;
const BLOCK = 4;
const COLUMNS = WIDTH / BLOCK;

/** Deterministic rolling hills, 2–5 blocks tall (no Math.random → identical SSR/CSR output). */
const HEIGHTS = Array.from({ length: COLUMNS }, (_, i) =>
  Math.max(2, Math.min(5, Math.round(3.4 + Math.sin(i / 3.1) * 1.3 + Math.sin(i / 1.7 + 1) * 0.6))),
);
const TREES = [5, 19, 31, 46, 60];
const CLOUDS: Array<[number, number, number]> = [
  [18, 7, 20],
  [70, 4, 28],
  [128, 9, 16],
  [176, 5, 22],
  [236, 8, 26],
];
/** Leaf blocks relative to the trunk column: [dx, blocks above ground]. */
const CANOPY: Array<[number, number]> = [
  [-1, 3], [0, 3], [1, 3],
  [-1, 4], [0, 4], [1, 4],
  [0, 5],
];

type Texture = keyof typeof BLOCK_TEXTURES;
const TEXTURES = Object.keys(BLOCK_TEXTURES) as Texture[];

function Block({ x, y, texture }: { x: number; y: number; texture: Texture }) {
  return <rect x={x} y={y} width={BLOCK} height={BLOCK} fill={`url(#mc-${texture})`} />;
}

function Column({ index }: { index: number }) {
  const blocks = HEIGHTS[index];
  const x = index * BLOCK;
  return (
    <g>
      {Array.from({ length: blocks }, (_, row) => (
        <Block key={row} x={x} y={HEIGHT - (row + 1) * BLOCK} texture={row === blocks - 1 ? 'grass' : row === 0 ? 'stone' : 'dirt'} />
      ))}
    </g>
  );
}

function Tree({ column }: { column: number }) {
  const x = column * BLOCK;
  const ground = HEIGHT - HEIGHTS[column] * BLOCK;
  return (
    <g>
      <Block x={x} y={ground - BLOCK} texture="log" />
      <Block x={x} y={ground - 2 * BLOCK} texture="log" />
      {CANOPY.map(([dx, up]) => (
        <Block key={`${dx}-${up}`} x={x + dx * BLOCK} y={ground - up * BLOCK} texture="leaves" />
      ))}
    </g>
  );
}

function PixelLandscape() {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMax slice"
      shapeRendering="crispEdges"
      className="h-full w-full"
      aria-hidden
    >
      <defs>
        {TEXTURES.map((name) => (
          <pattern key={name} id={`mc-${name}`} width={BLOCK} height={BLOCK} patternUnits="userSpaceOnUse">
            <image href={withBasePath(BLOCK_TEXTURES[name])} width={BLOCK} height={BLOCK} className="pixelated" />
          </pattern>
        ))}
      </defs>
      <rect x={WIDTH - 22} y={4} width={8} height={8} style={{ fill: 'var(--color-celestial)' }} />
      {CLOUDS.map(([x, y, w]) => (
        <g key={x} className="hero-cloud">
          <rect x={x} y={y} width={w} height={2} />
          <rect x={x + 3} y={y - 1} width={w - 8} height={1} />
        </g>
      ))}
      <g className="hero-ground">
        {HEIGHTS.map((_, i) => (
          <Column key={i} index={i} />
        ))}
        {TREES.map((c) => (
          <Tree key={c} column={c} />
        ))}
      </g>
    </svg>
  );
}

/** Sky (or configured screenshots) behind the whole hero. */
export function HeroBackdrop() {
  if (HERO_ARTWORK) {
    return (
      <div className="absolute inset-0" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
        <img src={withBasePath(HERO_ARTWORK.day)} alt="" className="only-light h-full w-full object-cover" />
        {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
        <img src={withBasePath(HERO_ARTWORK.night)} alt="" className="only-dark h-full w-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-b from-bg/85 via-bg/70 to-bg" />
      </div>
    );
  }

  return <div className="absolute inset-0 bg-linear-to-b from-sky-top to-sky-bottom" aria-hidden />;
}

/**
 * Textured block strip at the bottom of the hero, in normal flow so it never covers content.
 * Keeps the scene's 6:1 aspect on wide screens (nothing cropped vertically); narrow screens
 * use the min height and crop the sides instead.
 */
export function HeroLandscape() {
  if (HERO_ARTWORK) return null;
  return (
    <div className="relative aspect-[6/1] min-h-36 w-full" aria-hidden>
      <PixelLandscape />
    </div>
  );
}
