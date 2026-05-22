export function HomePage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Welcome to UnSqitch</h2>
        <p className="text-muted-foreground mb-4">
          Open a directory containing a Sqitch project to get started.
        </p>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">
          Open a Project
        </button>
      </div>
    </div>
  );
}
