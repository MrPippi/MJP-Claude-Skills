import { PLATFORMS, type PlatformId } from '../lib/platform';
import { PixelIcon } from '@/shared/ui/PixelIcon';

export function PlatformBadge({ platform, className = '' }: { platform: PlatformId; className?: string }) {
  const info = PLATFORMS.find((p) => p.id === platform);
  const tone = platform === 'paper-nms' ? 'text-nms border-nms/35 bg-nms/5' : 'text-api border-api/35 bg-api/5';
  return (
    <span className={`inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 font-pixel text-[10px] uppercase ${tone} ${className}`}>
      {info && <PixelIcon name={info.icon} className="-my-1 h-4 w-4" />}
      {info?.label}
    </span>
  );
}
