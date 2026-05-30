import { useProjectStore } from '../../store/project';

export function StaleBanner() {
  const { statusStale } = useProjectStore();

  if (!statusStale) return null;

  return (
    <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2 flex items-center justify-between">
      <span className="text-sm text-yellow-700">Data may be outdated — switch sections or use Refresh to update</span>
    </div>
  );
}
