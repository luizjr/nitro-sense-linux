type Props = { rpm: number };

const CX = 110;
const CY = 110;
const BLADE_COUNT = 60;
const R_INNER = 66;
const R_OUTER = 96;

// Pre-compute the static blade geometry once at module load.
const BLADES = Array.from({ length: BLADE_COUNT }, (_, i) => {
  const a = (i / BLADE_COUNT) * Math.PI * 2;
  // each blade is slightly skewed for the curved "turbine" look
  const skew = 0.16;
  const x1 = CX + Math.cos(a) * R_INNER;
  const y1 = CY + Math.sin(a) * R_INNER;
  const x2 = CX + Math.cos(a + skew) * R_OUTER;
  const y2 = CY + Math.sin(a + skew) * R_OUTER;
  return { x1, y1, x2, y2 };
});

export default function FanGauge({ rpm }: Props) {
  // Map RPM to a rotation period: faster spin for higher RPM, capped both ways.
  const spinning = rpm > 60;
  const period = spinning
    ? Math.min(10, Math.max(0.7, 6000 / Math.max(rpm, 200)))
    : 0;

  return (
    <div className="gauge">
      <svg viewBox="0 0 220 220">
        <defs>
          <radialGradient id="hub" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1a1c1f" />
            <stop offset="78%" stopColor="#0e0f11" />
            <stop offset="100%" stopColor="#070708" />
          </radialGradient>
          <filter id="redglow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* red inner glow ring */}
        <circle
          cx={CX}
          cy={CY}
          r={R_INNER + 2}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.8"
          opacity="0.42"
          filter="url(#redglow)"
        />

        {/* rotating blades */}
        <g
          className="blades"
          style={
            period
              ? { animationDuration: `${period}s` }
              : { animationName: "none" }
          }
        >
          {BLADES.map((b, i) => (
            <line
              key={i}
              x1={b.x1}
              y1={b.y1}
              x2={b.x2}
              y2={b.y2}
              stroke="#868c95"
              strokeWidth="1.1"
              strokeLinecap="round"
              opacity="0.7"
            />
          ))}
        </g>

        {/* dark hub on top of the blade roots */}
        <circle cx={CX} cy={CY} r={R_INNER - 4} fill="url(#hub)" />
      </svg>

      <div className="center-num">
        <div className="rpm">{rpm > 0 ? rpm : "—"}</div>
        <div className="unit">RPM</div>
      </div>
    </div>
  );
}
