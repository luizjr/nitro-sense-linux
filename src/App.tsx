import { useEffect, useState } from "react";
import TopBar from "./components/TopBar";
import FanControl from "./components/FanControl";
import PowerPlan from "./components/PowerPlan";
import Monitoring from "./components/Monitoring";
import BatteryPanel from "./components/BatteryPanel";
import GpuPanel from "./components/GpuPanel";
import Unsupported from "./components/Unsupported";
import { api, SystemSupport } from "./lib/api";

export default function App() {
  const [support, setSupport] = useState<SystemSupport | null>(null);
  const [checked, setChecked] = useState(false);
  const [override, setOverride] = useState(false);

  useEffect(() => {
    api
      .systemSupport()
      .then(setSupport)
      .catch(() => setSupport(null)) // probe failed → fail open, show dashboard
      .finally(() => setChecked(true));
  }, []);

  // Block (and skip mounting the polling dashboard) only when the probe ran and
  // explicitly says the hardware is unsupported, unless the user overrode it.
  const blocked =
    checked && support !== null && !support.supported && !override;

  return (
    <div className="frame">
      <TopBar />
      {!checked ? (
        <div className="dashboard-loading" />
      ) : blocked ? (
        <Unsupported info={support!} onContinue={() => setOverride(true)} />
      ) : (
        <div className="dashboard">
          <FanControl />
          <div className="col-left">
            <PowerPlan />
            <GpuPanel />
            <BatteryPanel />
          </div>
          <Monitoring />
        </div>
      )}
    </div>
  );
}
