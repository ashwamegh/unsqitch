import { useNavigationStore } from '../../store/navigation';

export function ProjectPage() {
  const section = useNavigationStore((s) => s.section);

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <h2 className="text-xl font-semibold mb-4 capitalize">{section ?? 'Select a section'}</h2>
      <p className="text-muted-foreground">Section content will be implemented in Plan 5.</p>
    </div>
  );
}
