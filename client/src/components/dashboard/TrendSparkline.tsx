type SparklineProps = {
  points: Array<{ x: number; y: number }>;
  width?: number;
  height?: number;
  color?: string;
};

export const TrendSparkline = ({
  points,
  width = 160,
  height = 60,
  color = "#3AA18A",
}: SparklineProps) => {
  if (!points.length) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const path = points
    .map((p, i) => {
      const x = ((p.x - minX) / rangeX) * width;
      const y = height - ((p.y - minY) / rangeY) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.8" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L${width},${height} L0,${height} Z`}
        fill="url(#spark)"
        stroke="none"
        opacity={0.4}
      />
      <path d={path} stroke={color} strokeWidth={2} fill="none" />
    </svg>
  );
};


