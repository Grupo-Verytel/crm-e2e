import { useState } from "react";
import { DatePickerField } from "../../../components/DatePickerField";
import {
  corteDaysAgo,
  defaultCorte,
  formatDayTag,
} from "../lib/report-filters";

export function CorteShortcuts({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const seven = defaultCorte();
  const fourteen = corteDaysAgo(14);
  const preset = value === seven ? "7" : value === fourteen ? "14" : "custom";
  const [forceCustom, setForceCustom] = useState(false);
  const showPicker = forceCustom || preset === "custom";

  function selectPreset(next: string) {
    setForceCustom(false);
    onChange(next);
  }

  return (
    <div className="mb-3">
      <p className="mb-2 text-xs text-muted">
        Fecha de corte de este bloque. Cambiarla actualiza la movilización
        desde el último comité; el periodo de los demás bloques no cambia.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <button
          type="button"
          className={shortcutClass(preset === "7" && !forceCustom)}
          aria-pressed={preset === "7" && !forceCustom}
          onClick={() => selectPreset(seven)}
        >
          Hace 7 días
        </button>
        <button
          type="button"
          className={shortcutClass(preset === "14" && !forceCustom)}
          aria-pressed={preset === "14" && !forceCustom}
          onClick={() => selectPreset(fourteen)}
        >
          Hace 14 días
        </button>
        <button
          type="button"
          className={shortcutClass(showPicker)}
          aria-pressed={showPicker}
          onClick={() => setForceCustom(true)}
        >
          Personalizada
        </button>
        {showPicker ? (
          <div className="w-48">
            <DatePickerField
              id="reports-corte"
              value={value}
              aria-label={`Fecha de corte personalizada, ${formatDayTag(value)}`}
              onChange={(next) => {
                if (next) onChange(next);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function shortcutClass(active: boolean): string {
  return [
    "h-8 rounded border px-3 text-xs font-bold",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
    active
      ? "border-accent text-accent"
      : "border-border text-muted hover:text-accent",
  ].join(" ");
}
