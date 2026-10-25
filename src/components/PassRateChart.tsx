import { buildChart, describeChart, type ChartVersion } from "@/lib/evals/chart"
import { formatPercent } from "@/lib/evals/verdict"

const MARKER = 4.5 // circle radius; the square is 2 * MARKER wide, so both are at least 8px
const HIT = 14 // hover target, larger than the mark

/**
 * Pass rate per specialist version: dev (solid line, circles) and hold-out
 * (dashed line, squares), with the pass threshold marked. Server-rendered SVG:
 * no client JavaScript and no chart library. Colour is never the only channel
 * (line style and marker shape differ, each series is named on the chart and in
 * the legend), and the table on the page is the full text alternative.
 */
export default function PassRateChart({ versions }: { versions: ChartVersion[] }) {
  const g = buildChart(versions)
  if (!g) return null

  return (
    <div className="pass-rate-chart">
      <ul className="chart-legend" aria-label="Legend">
        <li>
          <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
            <line x1="1" y1="6" x2="27" y2="6" className="chart-line chart-dev" />
            <circle cx="14" cy="6" r={MARKER} className="chart-mark chart-dev-fill" />
          </svg>
          <span>Dev</span>
        </li>
        <li>
          <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
            <line x1="1" y1="6" x2="27" y2="6" className="chart-line chart-holdout chart-dashed" />
            <rect
              x={14 - MARKER}
              y={6 - MARKER}
              width={MARKER * 2}
              height={MARKER * 2}
              className="chart-mark chart-holdout-fill"
            />
          </svg>
          <span>Hold-out</span>
        </li>
      </ul>

      <svg
        className="chart-svg"
        viewBox={`0 0 ${g.width} ${g.height}`}
        role="img"
        aria-label={describeChart(versions)}
      >
        {/* gridlines and y-axis labels */}
        {g.yTicks.map((t) => (
          <g key={t.value}>
            <line x1={g.plot.left} x2={g.plot.right} y1={t.y} y2={t.y} className="chart-grid" />
            <text x={g.plot.left - 6} y={t.y + 4} textAnchor="end" className="chart-text">
              {t.label}
            </text>
          </g>
        ))}

        {/* version labels */}
        {g.xLabels.map((l) => (
          <text key={l.version} x={l.x} y={g.plot.bottom + 22} textAnchor="middle" className="chart-text">
            {l.version}
          </text>
        ))}

        {/* pass threshold, labelled outside the plot so it never touches data */}
        <line x1={g.plot.left} x2={g.plot.right} y1={g.threshold.y} y2={g.threshold.y} className="chart-threshold" />
        <text x={g.plot.right + 6} y={g.threshold.y + 4} className="chart-text">
          {g.threshold.label}
        </text>

        {/* lines */}
        {g.devPath && <path d={g.devPath} className="chart-line chart-dev" />}
        {g.holdoutPath && <path d={g.holdoutPath} className="chart-line chart-holdout chart-dashed" />}

        {/* markers, each with a ring in the surface colour so they stay legible where they cross */}
        {g.dev.map((p) => (
          <circle key={`d-${p.version}`} cx={p.x} cy={p.y} r={MARKER} className="chart-mark chart-dev-fill" />
        ))}
        {g.holdout.map((p) => (
          <rect
            key={`h-${p.version}`}
            x={p.x - MARKER}
            y={p.y - MARKER}
            width={MARKER * 2}
            height={MARKER * 2}
            className="chart-mark chart-holdout-fill"
          />
        ))}

        {/* each series named once, at its first point */}
        {g.labels.dev && (
          <text x={g.labels.dev.x} y={g.labels.dev.y} textAnchor="middle" className="chart-label">
            Dev
          </text>
        )}
        {g.labels.holdout && (
          <text x={g.labels.holdout.x} y={g.labels.holdout.y} textAnchor="middle" className="chart-label">
            Hold-out
          </text>
        )}

        {/* hover targets: larger than the marks, with a native tooltip */}
        {g.dev.map((p) => (
          <circle key={`dh-${p.version}`} cx={p.x} cy={p.y} r={HIT} className="chart-hit">
            <title>{`${p.version} dev pass rate: ${formatPercent(p.value)}`}</title>
          </circle>
        ))}
        {g.holdout.map((p) => (
          <circle key={`hh-${p.version}`} cx={p.x} cy={p.y} r={HIT} className="chart-hit">
            <title>{`${p.version} hold-out pass rate: ${formatPercent(p.value)}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  )
}
