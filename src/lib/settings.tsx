import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

export type TempUnit = "C" | "F";

type Settings = {
  unit: TempUnit;
  setUnit: (u: TempUnit) => void;
};

const SettingsContext = createContext<Settings>({
  unit: "C",
  setUnit: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [unit, setUnit] = useState<TempUnit>(
    () => (localStorage.getItem("tempUnit") as TempUnit) || "C",
  );

  useEffect(() => {
    localStorage.setItem("tempUnit", unit);
  }, [unit]);

  return (
    <SettingsContext.Provider value={{ unit, setUnit }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}

/** Format a Celsius value in the user's chosen unit, e.g. "53°C" / "127°F". */
export function formatTemp(celsius: number | null | undefined, unit: TempUnit) {
  if (celsius == null || Number.isNaN(celsius)) return "—";
  const v = unit === "F" ? celsius * 1.8 + 32 : celsius;
  return `${Math.round(v)}°${unit}`;
}
