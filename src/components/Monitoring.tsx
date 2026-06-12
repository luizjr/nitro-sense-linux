import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { formatTemp, useSettings } from "../lib/settings";

const MAX_POINTS = 90;

type Series = number[];

function Sparkline({ data }: { data: Series }) {
  if (data.length < 2) return <svg viewBox="0 0 100 100" preserveAspectRatio="none" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const lo = min - 2;
  const hi = max + 2;
  const span = hi - lo || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (MAX_POINTS - 1)) * 100;
      const y = 100 - ((v - lo) / span) * 92 - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `0,100 ${pts} ${((data.length - 1) / (MAX_POINTS - 1)) * 100},100`;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
      <polygon points={area} fill="rgba(226,35,26,0.12)" />
      <polyline
        points={pts}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.4"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Block({
  tag,
  temp,
  load,
  history,
}: {
  tag: string;
  temp: number | null;
  load: number | null;
  history: Series;
}) {
  const { unit } = useSettings();
  const min = history.length ? Math.min(...history) : null;
  const max = history.length ? Math.max(...history) : null;
  return (
    <div>
      <div className="mon-head" style={{ justifyContent: "flex-end" }}>
        <span className="mon-minmax">
          Min: <b>{formatTemp(min, unit)}</b> &nbsp; Max: <b>{formatTemp(max, unit)}</b>
        </span>
      </div>
      <div className="mon-block">
        <div className="mon-graph">
          <span className="tag">{tag}</span>
          <Sparkline data={history} />
        </div>
        <div className="mon-readout">
          <div className="mon-temp">{formatTemp(temp, unit)}</div>
          <div className="mon-load">{load != null ? `${Math.round(load)}` : "—"}<span> %</span></div>
        </div>
      </div>
    </div>
  );
}

export default function Monitoring() {
  const [cpuTemp, setCpuTemp] = useState<number | null>(null);
  const [cpuLoad, setCpuLoad] = useState<number | null>(null);
  const [gpuTemp, setGpuTemp] = useState<number | null>(null);
  const [gpuLoad, setGpuLoad] = useState<number | null>(null);
  const [error, setError] = useState("");
  const cpuHist = useRef<Series>([]);
  const gpuHist = useRef<Series>([]);
  const [, force] = useState(0);
  const { unit } = useSettings();

  const tick = async () => {
    try {
      const [s, g] = await Promise.all([
        api.readSensors(),
        api.readGpuStatus().catch(() => null),
      ]);
      const ct = s.cpu_package ?? s.acer[0]?.celsius ?? null;
      setCpuTemp(ct);
      setCpuLoad(s.cpu_load);
      if (ct != null) push(cpuHist.current, ct);
      if (g) {
        setGpuTemp(g.temp_c);
        setGpuLoad(g.utilization);
        push(gpuHist.current, g.temp_c);
      }
      setError("");
      force((n) => n + 1);
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    tick();
    const t = setInterval(tick, 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="panel">
      <div className="panel-headbar">
        <span className="panel-head">Monitoring</span>
      </div>
      <div className="panel-body">
        <div className="mon-title">Temperature (°{unit}) / Loading (%)</div>
        <Block tag="CPU" temp={cpuTemp} load={cpuLoad} history={cpuHist.current} />
        <Block tag="GPU" temp={gpuTemp} load={gpuLoad} history={gpuHist.current} />
        {error && <div className="err">{error}</div>}
      </div>
    </section>
  );
}

function push(arr: Series, v: number) {
  arr.push(v);
  if (arr.length > MAX_POINTS) arr.shift();
}
