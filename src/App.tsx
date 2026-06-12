import TopBar from "./components/TopBar";
import FanControl from "./components/FanControl";
import PowerPlan from "./components/PowerPlan";
import Monitoring from "./components/Monitoring";
import BatteryPanel from "./components/BatteryPanel";
import GpuPanel from "./components/GpuPanel";

export default function App() {
  return (
    <div className="frame">
      <TopBar />
      <div className="dashboard">
        <FanControl />
        <div className="col-left">
          <PowerPlan />
          <GpuPanel />
          <BatteryPanel />
        </div>
        <Monitoring />
      </div>
    </div>
  );
}
