type StatCardProps = {
  title: string;
  value: string | number;
  hint?: string;
  accent?: "blue" | "emerald" | "amber" | "pink";
};

const colors: Record<NonNullable<StatCardProps["accent"]>, string> = {
  blue: "bg-background-card border-brand-border",
  emerald: "bg-background-card border-brand-primary/50",
  amber: "bg-background-card border-amber-200",
  pink: "bg-background-card border-brand-primary-light/50",
};

export const StatCard = ({ title, value, hint, accent = "blue" }: StatCardProps) => {
  const accentClass = colors[accent] || colors.blue;
  return (
    <div
      className={`p-4 rounded-2xl border ${accentClass} shadow-lg shadow-slate-200/50`}
    >
      <p className="text-sm text-slate-600">{title}</p>
      <p className="text-2xl font-semibold mt-1 text-slate-900">{value}</p>
      {hint && <p className="text-xs text-slate-600 mt-1">{hint}</p>}
    </div>
  );
};


