import { PIXEL_ICONS, toRects, type PixelIconName } from './pixel-icons';
import { ITEM_ARTWORK } from '@/config/mc-assets';
import { withBasePath } from '@/config/routes';

interface PixelIconProps {
  name: PixelIconName;
  className?: string;
  /** Accessible label; omit for decorative icons. */
  title?: string;
}

const RECTS = Object.fromEntries(
  Object.entries(PIXEL_ICONS).map(([name, icon]) => [name, toRects(icon)]),
) as Record<PixelIconName, ReturnType<typeof toRects>>;

export function PixelIcon({ name, className, title }: PixelIconProps) {
  const artwork = ITEM_ARTWORK[name];
  if (artwork) {
    // eslint-disable-next-line @next/next/no-img-element -- static export, tiny pixel art
    return <img src={withBasePath(artwork)} alt={title ?? ''} className={`pixelated ${className ?? ''}`} width={16} height={16} loading="lazy" decoding="async" />;
  }

  const icon = PIXEL_ICONS[name];
  return (
    <svg
      viewBox={`0 0 ${icon.rows[0].length} ${icon.rows.length}`}
      className={className}
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {RECTS[name].map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.color} />
      ))}
    </svg>
  );
}
