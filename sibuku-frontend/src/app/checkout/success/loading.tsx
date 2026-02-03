export default function Loading() {
  return (
    <div className="container py-12">
      <div className="max-w-2xl mx-auto animate-pulse">
        <div className="h-8 w-64 rounded bg-white/5" />
        <div className="h-4 w-96 rounded bg-white/5 mt-3" />

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="h-4 w-48 rounded bg-white/5" />
          <div className="h-4 w-72 rounded bg-white/5 mt-3" />
          <div className="h-4 w-64 rounded bg-white/5 mt-3" />
          <div className="h-10 w-full rounded-xl bg-white/5 mt-6" />
          <div className="h-10 w-full rounded-xl bg-white/5 mt-3" />
        </div>
      </div>
    </div>
  );
}
