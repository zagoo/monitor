// Metric dictionary integrity: every record is complete and internally consistent.
import { describe, it, expect } from 'vitest'
import { METRIC_DICTIONARY, METRIC_BY_ID } from '../src/data/metrics.js'

const LEVELS = ['L0', 'L1', 'L2']
const PRIORITIES = ['P0', 'P1', 'P2', 'P3']
const LAYERS = ['hardware', 'system', 'k8s', 'network', 'storage', 'comm', 'training', 'cost', 'scheduling', 'expert']

describe('metric dictionary integrity', () => {
  it('has a non-trivial number of metrics', () => {
    expect(METRIC_DICTIONARY.length).toBeGreaterThanOrEqual(60)
  })

  it('every metric_id is unique', () => {
    const ids = METRIC_DICTIONARY.map((m) => m.metric_id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every record carries the full required tooltip payload', () => {
    for (const m of METRIC_DICTIONARY) {
      const ctx = m.metric_id
      // identity / classification
      expect(m.metric_id, ctx).toMatch(/^[a-z0-9_.]+$/)
      expect(m.display_name, ctx).toBeTruthy()
      expect(typeof m.unit, ctx).toBe('string')
      expect(LEVELS, ctx).toContain(m.level)
      expect(PRIORITIES, ctx).toContain(m.priority)
      expect(LAYERS, ctx).toContain(m.layer)
      // the six requested documentation fields
      expect(m.def, `${ctx}.def`).toBeTruthy()
      expect(m.calc, `${ctx}.calc`).toBeTruthy()
      expect(m.sig, `${ctx}.sig`).toBeTruthy()
      expect(m.notes, `${ctx}.notes`).toBeTruthy()
      expect(Array.isArray(m.related), `${ctx}.related`).toBe(true)
      expect(Array.isArray(m.confused), `${ctx}.confused`).toBe(true)
      // metadata
      expect(m.default_aggregation, `${ctx}.agg`).toBeTruthy()
      expect(Array.isArray(m.sources) && m.sources.length, `${ctx}.sources`).toBeTruthy()
      expect(Array.isArray(m.vendors) && m.vendors.length, `${ctx}.vendors`).toBeTruthy()
    }
  })

  it('confused-with entries are well formed', () => {
    for (const m of METRIC_DICTIONARY) {
      for (const c of m.confused) {
        expect(c.name, m.metric_id).toBeTruthy()
        expect(c.diff, m.metric_id).toBeTruthy()
      }
    }
  })

  it('every related-metric id resolves to a real dictionary entry', () => {
    for (const m of METRIC_DICTIONARY) {
      for (const rid of m.related) {
        expect(METRIC_BY_ID[rid], `${m.metric_id} → ${rid}`).toBeTruthy()
      }
    }
  })
})
