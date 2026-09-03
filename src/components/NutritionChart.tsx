"use client";

import styles from "./NutritionChart.module.css";

type NutritionData = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type Props = {
  nutrition: NutritionData;
};

type Slice = {
  label: string;
  value: number;
  color: string;
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export default function NutritionChart({ nutrition }: Props) {
  const { calories, protein_g, carbs_g, fat_g } = nutrition;
  const total = protein_g + carbs_g + fat_g;

  if (total === 0) return null;

  const slices: Slice[] = [
    { label: 'タンパク質', value: protein_g, color: '#ff6f91' },
    { label: '炭水化物', value: carbs_g, color: '#20b2aa' },
    { label: '脂質', value: fat_g, color: '#fbbf24' },
  ];

  const cx = 60;
  const cy = 60;
  const r = 50;

  let currentAngle = 0;
  const paths = slices.map((slice) => {
    const angle = (slice.value / total) * 360;
    const path = describeArc(cx, cy, r, currentAngle, currentAngle + angle);
    currentAngle += angle;
    return { ...slice, path, angle };
  });

  return (
    <div className={styles.container}>
      <div className={styles.chartWrap}>
        <svg width={120} height={120} viewBox="0 0 120 120">
          {paths.map((p) =>
            p.angle > 0 ? (
              <path key={p.label} d={p.path} fill={p.color} opacity={0.9} />
            ) : null
          )}
          <circle cx={cx} cy={cy} r={28} fill="var(--card-bg, #fff)" />
          <text x={cx} y={cy - 5} textAnchor="middle" fontSize="11" fontWeight="bold" fill="var(--text-primary, #333)">
            {calories}
          </text>
          <text x={cx} y={cy + 9} textAnchor="middle" fontSize="8" fill="var(--text-muted, #888)">
            kcal
          </text>
        </svg>
      </div>
      <div className={styles.legend}>
        {slices.map((s) => (
          <div key={s.label} className={styles.legendItem}>
            <span className={styles.dot} style={{ background: s.color }} />
            <span className={styles.legendLabel}>{s.label}</span>
            <span className={styles.legendValue}>{s.value}g</span>
          </div>
        ))}
      </div>
    </div>
  );
}
