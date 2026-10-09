import { PIXEL_ICONS, toRects, type PixelIconName } from './pixel-icons';

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
  const icon = PIXEL_ICONS[name];
  const size = icon.rows.length;
  return (
    <svg
      viewBox={`0 0 ${icon.rows[0].length} ${size}`}
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
