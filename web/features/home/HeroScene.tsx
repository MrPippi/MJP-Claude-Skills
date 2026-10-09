import { HERO_ARTWORK } from '@/config/mc-assets';
import { withBasePath } from '@/config/routes';

/** Scene grid: 1 unit = 1 pixel, 4 units = 1 block. */
const WIDTH = 192;
const HEIGHT = 44;
const BLOCK = 4;
const COLUMNS = WIDTH / BLOCK;

/** Deterministic rolling hills, 2–5 blocks tall (no Math.random → identical SSR/CSR output). */
const HEIGHTS = Array.from({ length: COLUMNS }, (_, i) =>
  Math.max(2, Math.min(5, Math.round(3.4 + Math.sin(i / 3.1) * 1.3 + Math.sin(i / 1.7 + 1) * 0.6))),
);
const TREES = [6, 19, 33, 41];
const CLOUDS: Array<[number, number, number]> = [
  [18, 6, 20],
  [70, 3, 28],
  [128, 8, 16],
  [160, 4, 22],
];

const fill = (token: string) => ({ fill: `var(--color-${token})` });

function Column({ index }: { index: number }) {
  const blocks = HEIGHTS[index];
  const x = index * BLOCK;
  const top = HEIGHT - blocks * BLOCK;
  return (
    <g>
      <rect x={x} y={top} width={BLOCK} height={blocks * BLOCK} style={fill('mc-dirt')} />
      <rect x={x} y={HEIGHT - BLOCK} width={BLOCK} height={BLOCK} style={fill('mc-stone')} />
      <rect x={x} y={top} width={BLOCK} height={1} style={fill('mc-grass')} />
      <rect x={x + (index % 3)} y={top + 1} width={1} height={1} style={fill('mc-grass-dark')} />
      {blocks > 2 && <rect x={x + ((index + 2) % 4)} y={top + BLOCK + 1} width={1} height={1} style={fill('mc-dirt-dark')} />}
      <rect x={x + (index % 2) * 2} y={HEIGHT - 2} width={1} height={1} style={fill('mc-dirt-dark')} opacity={0.5} />
    </g>
  );
}

function Tree({ column }: { column: number }) {
  const x = column * BLOCK + 1;
  const ground = HEIGHT - HEIGHTS[column] * BLOCK;
  return (
    <g>
      <rect x={x} y={ground - 6} width={2} height={6} style={fill('mc-wood')} />
      <rect x={x - 3} y={ground - 11} width={8} height={5} style={fill('mc-leaf')} />
      <rect x={x - 1} y={ground - 13} width={4} height={2} style={fill('mc-leaf')} />
    </g>
  );
}

function PixelLandscape() {
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMax slice" shapeRendering="crispEdges" className="h-full w-full" aria-hidden>
      <rect x={WIDTH - 30} y={4} width={8} height={8} style={fill('celestial')} />
      {CLOUDS.map(([x, y, w]) => (
        <g key={x} opacity={0.85}>
          <rect x={x} y={y} width={w} height={2} style={fill('mc-cloud')} />
          <rect x={x + 3} y={y - 1} width={w - 8} height={1} style={fill('mc-cloud')} />
        </g>
      ))}
      {HEIGHTS.map((_, i) => (
        <Column key={i} index={i} />
      ))}
      {TREES.map((c) => (
        <Tree key={c} column={c} />
      ))}
    </svg>
  );
}

/** Hero backdrop: in-game screenshots when configured, otherwise SVG pixel art. */
export function HeroScene() {
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

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-linear-to-b from-sky-top to-sky-bottom" />
      <div className="absolute inset-x-0 bottom-0 h-40 opacity-90 sm:h-52">
        <PixelLandscape />
      </div>
    </div>
  );
}
