// UI TOOLTIP COVERAGE
// 1. Every metric id referenced anywhere in the UI must resolve to a dictionary entry.
// 2. Each page/drawer that displays metric values must wire up at least one MetricTooltip.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { METRIC_BY_ID } from '../src/data/metrics.js'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = join(here, '..', 'src')

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(p))
    else if (/\.(vue|js)$/.test(entry.name)) out.push(p)
  }
  return out
}

const files = walk(SRC)

// Extract every metric id referenced via a metric-id / metricId binding.
function metricRefs(text) {
  const ids = new Set()
  const patterns = [
    // STATIC metric-id="x" only — the negative lookbehind for ':' skips Vue dynamic
    // bindings like :metric-id="mm.metric_id" whose value is an expression, not an id.
    /(?<![:\w-])metric-id="([a-z0-9_.]+)"/g,
    /metricId:\s*'([a-z0-9_.]+)'/g, // h(MetricTooltip, { metricId: 'x' })
    /\bmetric:\s*'([a-z0-9_.]+)'/g // ResourcesPage COLS { metric: 'x' }
  ]
  for (const re of patterns) {
    let m
    while ((m = re.exec(text))) ids.add(m[1])
  }
  return ids
}

describe('UI metric-id references resolve', () => {
  it('every metric id used in the UI exists in the dictionary', () => {
    const offenders = []
    for (const f of files) {
      const text = readFileSync(f, 'utf8')
      for (const id of metricRefs(text)) {
        if (!METRIC_BY_ID[id]) offenders.push(`${id}  (in ${f.replace(SRC, 'src')})`)
      }
    }
    expect(offenders, `unresolved metric ids:\n${offenders.join('\n')}`).toEqual([])
  })
})

describe('metric-bearing surfaces wire up tooltips', () => {
  // pages/components that render concrete metric values
  const MUST_USE_TOOLTIP = [
    'components/common/KpiCard.vue',
    'components/pages/OverviewPage.vue',
    'components/pages/ResourcesPage.vue',
    'components/pages/JobsPage.vue',
    'components/pages/TrendsPage.vue',
    'components/pages/CostPage.vue',
    'components/pages/SettingsPage.vue'
  ]
  for (const rel of MUST_USE_TOOLTIP) {
    it(`${rel} references MetricTooltip`, () => {
      const text = readFileSync(join(SRC, rel), 'utf8')
      expect(text.includes('MetricTooltip')).toBe(true)
    })
  }
})
