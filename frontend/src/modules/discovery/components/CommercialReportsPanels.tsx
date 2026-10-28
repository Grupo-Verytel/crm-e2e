import type { ReactNode } from "react";
import type {
  AgeRangeId,
  CommitteeReport,
  CommercialReportDetailOpen,
  PipelineHealthReport,
  StageBlock,
} from "../api/commercial-reports-api";
import { OUV_ZONA_LABEL, type OuvZona } from "../lib/ouv-vocab";
import {
  formatCompactMoney,
  formatPeriodDate,
} from "../lib/ouv-dashboard-format";
import { cardClass } from "./ui";

const AGE_RANGES: { range: AgeRangeId; label: string }[] = [
  { range: "1_2", label: "1–2 años" },
  { range: "2_3", label: "2–3 años" },
  { range: "over_3", label: "Más de 3 años" },
];

function estadoLabel(value: string | null): string {
  if (!value) return "—";
  if (value in OUV_ZONA_LABEL) return OUV_ZONA_LABEL[value as OuvZona];
  return value;
}

function sumRounded(values: number[]): number {
  return values.reduce((sum, value) => sum + Math.round(value * 100), 0) / 100;
}

function rangeFigures(
  ranges: { range: AgeRangeId; count: number; amount: number }[],
  range: AgeRangeId,
): { count: number; amount: number } {
  const row = ranges.find((item) => item.range === range);
  return { count: row?.count ?? 0, amount: row?.amount ?? 0 };
}

function FigureButton({
  count,
  amount,
  extra,
  ariaLabel,
  metric,
  onClick,
}: {
  count: number;
  amount: number;
  extra?: string;
  ariaLabel: string;
  metric?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      data-metric={metric}
      data-count={count}
      data-amount={amount}
      className="text-left text-accent hover:underline"
    >
      <span className="block font-bold">
        {count}
        {extra ? <span className="font-normal"> {extra}</span> : null}
      </span>
      <span className="block text-xs">{formatCompactMoney(amount)}</span>
    </button>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${cardClass} p-4`}>
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function MobilizedCard({
  label,
  block,
  onClick,
}: {
  label: string;
  block: { ouv_count: number; event_count: number; amount: number };
  onClick: () => void;
}) {
  return (
    <div className="rounded border border-border p-3">
      <p className="mb-2 text-xs font-bold text-ink">{label}</p>
      <FigureButton
        count={block.ouv_count}
        amount={block.amount}
        extra={`(${block.event_count} ${block.event_count === 1 ? "evento" : "eventos"})`}
        ariaLabel={`${label}: ${block.ouv_count} ${block.ouv_count === 1 ? "OUV" : "OUVs"}, ${block.event_count} ${block.event_count === 1 ? "evento" : "eventos"}`}
        onClick={onClick}
      />
    </div>
  );
}

function StageMatrix({
  title,
  block,
  kind,
  onOpenDetail,
}: {
  title: string;
  block: StageBlock;
  kind: CommercialReportDetailOpen["kind"];
  onOpenDetail: (request: CommercialReportDetailOpen) => void;
}) {
  return (
    <div>
      <FigureButton
        count={block.ouv_count}
        amount={block.ouv_amount}
        extra={`(${block.event_count} ${block.event_count === 1 ? "evento" : "eventos"})`}
        ariaLabel={`${title}: ${block.ouv_count} OUVs, ${block.event_count} eventos`}
        onClick={() =>
          onOpenDetail({
            report: "committee",
            kind,
            title,
          })
        }
      />
      {block.cells.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Sin movimientos en el periodo.
        </p>
      ) : (
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="pb-2 font-bold">Desde</th>
              <th className="pb-2 font-bold">Hasta</th>
              <th className="pb-2 font-bold">OUVs (eventos)</th>
              <th className="pb-2 font-bold">Monto actual</th>
            </tr>
          </thead>
          <tbody>
            {block.cells.map((cell) => (
              <tr
                key={`${cell.from_estado ?? ""}-${cell.to_estado}`}
                className="border-t border-border"
              >
                <td className="py-2 pr-2 text-ink">
                  {estadoLabel(cell.from_estado)}
                </td>
                <td className="py-2 pr-2 text-ink">
                  {estadoLabel(cell.to_estado)}
                </td>
                <td className="py-2 pr-2">
                  <button
                    type="button"
                    className="text-left text-accent hover:underline"
                    data-from={cell.from_estado ?? ""}
                    data-to={cell.to_estado}
                    data-ouv-count={cell.ouv_count}
                    data-event-count={cell.event_count}
                    aria-label={`${estadoLabel(cell.from_estado)} a ${estadoLabel(cell.to_estado)}: ${cell.ouv_count} OUVs, ${cell.event_count} eventos`}
                    onClick={() =>
                      onOpenDetail({
                        report: "committee",
                        kind,
                        title: `${estadoLabel(cell.from_estado)} → ${estadoLabel(cell.to_estado)}`,
                        ...(cell.from_estado
                          ? { from_estado: cell.from_estado }
                          : {}),
                        to_estado: cell.to_estado,
                      })
                    }
                  >
                    <span className="font-bold">{cell.ouv_count}</span>
                    <span> ({cell.event_count})</span>
                  </button>
                </td>
                <td className="py-2 text-ink">
                  {formatCompactMoney(cell.ouv_amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function CommitteePanels({
  data,
  onOpenDetail,
}: {
  data: CommitteeReport;
  onOpenDetail: (request: CommercialReportDetailOpen) => void;
}) {
  const m025Count = data.m025.by_segment.reduce(
    (sum, row) => sum + row.count,
    0,
  );
  const m025Amount = sumRounded(data.m025.by_segment.map((row) => row.amount));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted">
        Desde el {formatPeriodDate(data.fecha_corte)} hasta el{" "}
        {formatPeriodDate(data.as_of)}.
        {data.excluded_synthetic > 0
          ? ` ${data.excluded_synthetic} movimientos sintéticos quedaron fuera del conteo.`
          : ""}
      </p>

      <Section
        title="M003 · Movilización desde el último comité"
        note="Historial de montos incompleto para OUVs importadas. Una OUV con varios movimientos cuenta una vez en OUVs movilizadas."
      >
        <div className="mb-3">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
            OUVs movilizadas
          </p>
          <FigureButton
            count={data.m003.mobilized.ouv_count}
            amount={data.m003.mobilized.amount}
            extra={`(${data.m003.mobilized.event_count} eventos)`}
            ariaLabel={`OUVs movilizadas: ${data.m003.mobilized.ouv_count}`}
            metric="m003-mobilized"
            onClick={() =>
              onOpenDetail({
                report: "committee",
                kind: "m003_mobilized",
                title: "OUVs movilizadas",
              })
            }
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MobilizedCard
            label="Nuevas"
            block={data.m003.new_ouvs}
            onClick={() =>
              onOpenDetail({
                report: "committee",
                kind: "m003_new",
                title: "Nuevas desde el comité",
              })
            }
          />
          <MobilizedCard
            label="Cambios de zona"
            block={data.m003.zone_changes}
            onClick={() =>
              onOpenDetail({
                report: "committee",
                kind: "m003_zone_changes",
                title: "Cambios de zona",
              })
            }
          />
          <MobilizedCard
            label="Cambios de monto"
            block={data.m003.amount_changes}
            onClick={() =>
              onOpenDetail({
                report: "committee",
                kind: "m003_amount_changes",
                title: "Cambios de monto",
              })
            }
          />
          <MobilizedCard
            label="Ganadas"
            block={data.m003.won}
            onClick={() =>
              onOpenDetail({
                report: "committee",
                kind: "m003_won",
                title: "Ganadas desde el comité",
              })
            }
          />
          <MobilizedCard
            label="Perdidas"
            block={data.m003.lost}
            onClick={() =>
              onOpenDetail({
                report: "committee",
                kind: "m003_lost",
                title: "Perdidas desde el comité",
              })
            }
          />
        </div>
      </Section>

      <Section
        title="M035 · Cambios de etapa"
        note="Monto actual de las OUVs, no el del momento del cambio. La cifra principal es la OUV distinta; los eventos van entre paréntesis."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-bold text-ink">Avances</h3>
            <StageMatrix
              title="Avances"
              block={data.m035.advances}
              kind="m035_advances"
              onOpenDetail={onOpenDetail}
            />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold text-ink">Retrocesos</h3>
            <StageMatrix
              title="Retrocesos"
              block={data.m035.retreats}
              kind="m035_retreats"
              onOpenDetail={onOpenDetail}
            />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold text-ink">Cierres</h3>
            <StageMatrix
              title="Cierres"
              block={data.m035.closures}
              kind="m035_closures"
              onOpenDetail={onOpenDetail}
            />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold text-ink">Reaperturas</h3>
            <StageMatrix
              title="Reaperturas"
              block={data.m035.reopenings}
              kind="m035_reopenings"
              onOpenDetail={onOpenDetail}
            />
          </div>
        </div>
      </Section>

      <Section title="M025 · Nuevas en el trimestre">
        <div className="mb-3">
          <FigureButton
            count={m025Count}
            amount={m025Amount}
            ariaLabel={`Nuevas en el trimestre: ${m025Count}`}
            metric="m025"
            onClick={() =>
              onOpenDetail({
                report: "committee",
                kind: "m025_new",
                title: "Nuevas en el trimestre",
              })
            }
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="pb-2 font-bold">Segmento</th>
                <th className="pb-2 font-bold">OUVs</th>
              </tr>
            </thead>
            <tbody>
              {data.m025.by_segment.map((row) => (
                <tr key={row.segmento} className="border-t border-border">
                  <td className="py-2 pr-2 text-ink">{row.segmento}</td>
                  <td className="py-2">
                    <FigureButton
                      count={row.count}
                      amount={row.amount}
                      ariaLabel={`Nuevas ${row.segmento}: ${row.count}`}
                      onClick={() =>
                        onOpenDetail({
                          report: "committee",
                          kind: "m025_new",
                          title: `Nuevas · ${row.segmento}`,
                          segmento: row.segmento,
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="pb-2 font-bold">Comercial</th>
                <th className="pb-2 font-bold">OUVs</th>
              </tr>
            </thead>
            <tbody>
              {data.m025.by_commercial.map((row) => (
                <tr key={row.user_id} className="border-t border-border">
                  <td className="py-2 pr-2 text-ink">{row.full_name}</td>
                  <td className="py-2">
                    <FigureButton
                      count={row.count}
                      amount={row.amount}
                      ariaLabel={`Nuevas ${row.full_name}: ${row.count}`}
                      onClick={() =>
                        onOpenDetail({
                          report: "committee",
                          kind: "m025_new",
                          title: `Nuevas · ${row.full_name}`,
                          comercial_id: row.user_id,
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="M013 · Cierre previsto en el trimestre">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="pb-2 font-bold">Resultado</th>
              <th className="pb-2 font-bold">Con fecha prevista</th>
              <th className="pb-2 font-bold">Creadas en el periodo</th>
            </tr>
          </thead>
          <tbody>
            {data.m013.by_resultado.map((row) => (
              <tr key={row.resultado} className="border-t border-border">
                <td className="py-2 pr-2 text-ink">{row.resultado}</td>
                <td className="py-2 pr-2">
                  <FigureButton
                    count={row.count}
                    amount={row.amount}
                    ariaLabel={`${row.resultado} con fecha prevista: ${row.count}`}
                    onClick={() =>
                      onOpenDetail({
                        report: "committee",
                        kind: "m013_expected_close",
                        title: `Cierre previsto · ${row.resultado}`,
                        resultado: row.resultado,
                      })
                    }
                  />
                </td>
                <td className="py-2">
                  <FigureButton
                    count={row.created_in_period}
                    amount={row.created_in_period_amount}
                    ariaLabel={`${row.resultado} creadas en el periodo: ${row.created_in_period}`}
                    onClick={() =>
                      onOpenDetail({
                        report: "committee",
                        kind: "m013_created_in_period",
                        title: `Creadas en el periodo · ${row.resultado}`,
                        resultado: row.resultado,
                      })
                    }
                  />
                </td>
              </tr>
            ))}
            <tr className="border-t border-border">
              <td className="py-2 pr-2 text-ink">Sin fecha prevista</td>
              <td className="py-2" colSpan={2}>
                <FigureButton
                  count={data.m013.missing_expected_close.count}
                  amount={data.m013.missing_expected_close.amount}
                  ariaLabel={`Sin fecha prevista: ${data.m013.missing_expected_close.count}`}
                  metric="m013-missing"
                  onClick={() =>
                    onOpenDetail({
                      report: "committee",
                      kind: "m013_missing_close",
                      title: "Sin fecha prevista",
                    })
                  }
                />
              </td>
            </tr>
          </tbody>
        </table>
      </Section>
    </div>
  );
}

export function PipelineHealthPanels({
  data,
  onOpenDetail,
}: {
  data: PipelineHealthReport;
  onOpenDetail: (request: CommercialReportDetailOpen) => void;
}) {
  const aged = data.m023.ranges.reduce((sum, row) => sum + row.count, 0);
  const agedAmount = sumRounded(data.m023.ranges.map((row) => row.amount));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted">
        Edad al {formatPeriodDate(data.as_of)}. Los tres rangos se muestran
        aunque estén en cero.
      </p>
      <Section title="M023 · OUVs abiertas con más de 365 días">
        <div className="mb-3">
          <FigureButton
            count={aged}
            amount={agedAmount}
            ariaLabel={`OUVs con más de 365 días: ${aged}`}
            metric="m023-aged"
            onClick={() =>
              onOpenDetail({
                report: "pipeline-health",
                kind: "m023_aged",
                title: "Más de 365 días",
              })
            }
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {AGE_RANGES.map((range) => {
            const figures = rangeFigures(data.m023.ranges, range.range);
            const kind =
              range.range === "1_2"
                ? "m023_1_2"
                : range.range === "2_3"
                  ? "m023_2_3"
                  : "m023_over_3";
            return (
              <div
                key={range.range}
                className="rounded border border-border p-3"
              >
                <p className="mb-2 text-xs font-bold text-ink">{range.label}</p>
                <FigureButton
                  count={figures.count}
                  amount={figures.amount}
                  ariaLabel={`${range.label}: ${figures.count}`}
                  metric={`m023-${range.range}`}
                  onClick={() =>
                    onOpenDetail({
                      report: "pipeline-health",
                      kind,
                      title: range.label,
                    })
                  }
                />
              </div>
            );
          })}
        </div>
        <h3 className="mb-2 mt-4 text-xs font-bold text-ink">Por segmento</h3>
        <AgeBreakdown
          rows={data.m023.by_segment.map((row) => ({
            key: row.segmento,
            label: row.segmento,
            ranges: row.ranges,
          }))}
          onOpen={(label, range) =>
            onOpenDetail({
              report: "pipeline-health",
              kind:
                range === "1_2"
                  ? "m023_1_2"
                  : range === "2_3"
                    ? "m023_2_3"
                    : "m023_over_3",
              title: `${label} · ${AGE_RANGES.find((item) => item.range === range)?.label ?? ""}`,
              segmento: label,
            })
          }
        />
        <h3 className="mb-2 mt-4 text-xs font-bold text-ink">Por comercial</h3>
        <AgeBreakdown
          rows={data.m023.by_commercial.map((row) => ({
            key: row.user_id,
            label: row.full_name,
            ranges: row.ranges,
            comercial_id: row.user_id,
          }))}
          onOpen={(label, range, comercialId) =>
            onOpenDetail({
              report: "pipeline-health",
              kind:
                range === "1_2"
                  ? "m023_1_2"
                  : range === "2_3"
                    ? "m023_2_3"
                    : "m023_over_3",
              title: `${label} · ${AGE_RANGES.find((item) => item.range === range)?.label ?? ""}`,
              ...(comercialId ? { comercial_id: comercialId } : {}),
            })
          }
        />
      </Section>
      <Section title="Edad promedio de las OUVs abiertas">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-muted">
              <th className="pb-2 font-bold">Segmento</th>
              <th className="pb-2 font-bold">OUVs</th>
              <th className="pb-2 font-bold">Edad promedio</th>
            </tr>
          </thead>
          <tbody>
            {data.average_age.by_segment.map((row) => (
              <tr key={row.segmento} className="border-t border-border">
                <td className="py-2 pr-2 text-ink">{row.segmento}</td>
                <td className="py-2 pr-2">
                  <FigureButton
                    count={row.count}
                    amount={row.amount}
                    ariaLabel={`Edad promedio ${row.segmento}: ${row.count} OUVs`}
                    onClick={() =>
                      onOpenDetail({
                        report: "pipeline-health",
                        kind: "open_average_age",
                        title: `Edad promedio · ${row.segmento} · ${row.avg_days} días`,
                        segmento: row.segmento,
                      })
                    }
                  />
                </td>
                <td className="py-2 text-ink">
                  {row.avg_days.toLocaleString("es-CO", {
                    maximumFractionDigits: 1,
                  })}{" "}
                  días
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function AgeBreakdown({
  rows,
  onOpen,
}: {
  rows: {
    key: string;
    label: string;
    ranges: { range: AgeRangeId; count: number; amount: number }[];
    comercial_id?: string;
  }[];
  onOpen: (label: string, range: AgeRangeId, comercialId?: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">Sin OUVs en estos rangos.</p>;
  }
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="text-xs text-muted">
          <th className="pb-2 font-bold">Nombre</th>
          {AGE_RANGES.map((range) => (
            <th key={range.range} className="pb-2 font-bold">
              {range.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-t border-border">
            <td className="py-2 pr-2 text-ink">{row.label}</td>
            {AGE_RANGES.map((range) => {
              const figures = rangeFigures(row.ranges, range.range);
              return (
                <td key={range.range} className="py-2 pr-2">
                  <FigureButton
                    count={figures.count}
                    amount={figures.amount}
                    ariaLabel={`${row.label}, ${range.label}: ${figures.count}`}
                    onClick={() =>
                      onOpen(row.label, range.range, row.comercial_id)
                    }
                  />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
