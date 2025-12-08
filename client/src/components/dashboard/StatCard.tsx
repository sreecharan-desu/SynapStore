type StatCardProps = {
  title: string;
  value: string | number;
  hint?: string;
  accent?: "blue" | "emerald" | "amber" | "pink";
};

const colors: Record<NonNullable<StatCardProps["accent"]>, string> = {
  blue: "from-blue-500/30 to-blue-400/20 border-blue-400/30",
  emerald: "from-emerald-500/30 to-emerald-400/20 border-emerald-400/30",
  amber: "from-amber-500/30 to-amber-400/20 border-amber-400/30",
  pink: "from-pink-500/30 to-pink-400/20 border-pink-400/30",
};

export const StatCard = ({ title, value, hint, accent = "blue" }: StatCardProps) => {
  const accentClass = colors[accent] || colors.blue;
  return (
    <div
      className={`p-4 rounded-2xl border backdrop-blur bg-gradient-to-br ${accentClass} text-white shadow-lg shadow-black/30`}
    >
      <p className="text-sm text-white/70">{title}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {hint && <p className="text-xs text-white/60 mt-1">{hint}</p>}
    </div>
  );
};


