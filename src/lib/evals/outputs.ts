import type { OutputValues } from "./grade"
import { ID_PATTERN, type SpecialistSpec, type ValidationError } from "./spec"

/**
 * The file a team imports to get a verdict: what its specialist returned for every scenario.
 * Validation is pure and strict, in the same spirit as the specialist config: a size cap,
 * strict structure, every scenario present, nothing unknown, and errors that name the place.
 */
export const OUTPUTS_FORMAT = "agentclinic.outputs/1"

export const OUTPUT_LIMITS = {
  maxBytes: 1024 * 1024,
  maxValueLength: 5000,
  maxSummaryLength: 300,
  maxErrors: 25,
} as const

export const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,29}$/

export type ParsedOutputs = {
  version: string
  /** Present only when the file supplied it. Required when the version is new. */
  releasedAt: Date | null
  summary: string
  outputs: Record<string, OutputValues>
}

export type OutputsResult = { ok: true; data: ParsedOutputs; isNewVersion: boolean } | { ok: false; errors: ValidationError[] }

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

const has = (obj: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(obj, key)

const quote = (s: string) => JSON.stringify(s.length > 40 ? s.slice(0, 40) + "…" : s)

/** The versions that exist already, as the store knows them, oldest first. */
export type KnownVersion = { label: string; releasedAt: Date }

export function validateOutputs(
  text: string,
  spec: Pick<SpecialistSpec, "outputFields" | "scenarios">,
  known: KnownVersion[],
  now: Date = new Date()
): OutputsResult {
  const errors: ValidationError[] = []
  let extra = 0
  const add = (path: string, message: string) => {
    if (errors.length < OUTPUT_LIMITS.maxErrors) errors.push({ path, message })
    else extra++
  }
  const finish = (): OutputsResult => ({
    ok: false,
    errors: extra > 0 ? [...errors, { path: "", message: `…and ${extra} more problem${extra === 1 ? "" : "s"} not shown.` }] : errors,
  })

  if (typeof text !== "string" || text.trim() === "") {
    return { ok: false, errors: [{ path: "", message: "The outputs file is empty. Paste or upload a JSON document." }] }
  }
  const bytes = new TextEncoder().encode(text).length
  if (bytes > OUTPUT_LIMITS.maxBytes) {
    return { ok: false, errors: [{ path: "", message: `The outputs file is ${Math.ceil(bytes / 1024)} KB, over the ${OUTPUT_LIMITS.maxBytes / 1024} KB limit.` }] }
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [{ path: "", message: `This is not valid JSON: ${e instanceof Error ? e.message : "unknown error"}` }] }
  }
  if (!isPlainObject(raw)) {
    return { ok: false, errors: [{ path: "", message: "The outputs file must be a JSON object, not a list or a single value." }] }
  }

  for (const key of Object.keys(raw)) {
    if (!["format", "version", "releasedAt", "summary", "outputs"].includes(key)) {
      add(key, "is not a recognised property (allowed: format, version, releasedAt, summary, outputs)")
    }
  }
  if (raw.format !== OUTPUTS_FORMAT) {
    add("format", `must be ${JSON.stringify(OUTPUTS_FORMAT)}${raw.format === undefined ? " (it is missing)" : ""}`)
  }

  // version
  let version: string | null = null
  if (typeof raw.version !== "string") add("version", "is required and must be text, for example \"v2\"")
  else if (!VERSION_PATTERN.test(raw.version)) {
    add("version", `${quote(raw.version)} is not a valid version label: use letters, digits, . - or _, up to 30 characters`)
  } else version = raw.version

  const existing = version === null ? undefined : known.find((k) => k.label === version)
  const isNewVersion = version !== null && !existing

  // releasedAt: required for a new version; ignored for one that exists
  let releasedAt: Date | null = null
  // An empty string (as in the skeleton) counts as not given.
  const given = raw.releasedAt === "" ? undefined : raw.releasedAt
  if (given !== undefined && given !== null) {
    const parsed = typeof given === "string" ? new Date(given) : null
    if (!parsed || Number.isNaN(parsed.getTime()) || !/^\d{4}-\d{2}-\d{2}/.test(given as string)) {
      add("releasedAt", "must be a date and time such as \"2026-10-20T09:00:00Z\"")
    } else releasedAt = parsed
  }
  if (isNewVersion) {
    if (given === undefined || given === null) {
      add("releasedAt", "is required the first time a version is imported: it is when the change shipped, the start of the loop-time measurement")
    } else if (releasedAt) {
      if (releasedAt.getTime() > now.getTime()) add("releasedAt", "cannot be in the future")
      const latest = known.length > 0 ? known.reduce((a, b) => (b.releasedAt.getTime() >= a.releasedAt.getTime() ? b : a)) : null
      if (latest && releasedAt.getTime() <= latest.releasedAt.getTime()) {
        add("releasedAt", `must be after the release of ${latest.label} (${latest.releasedAt.toISOString()}), because versions are ordered by release time`)
      }
    }
  }

  // summary
  let summary = ""
  if (raw.summary !== undefined && raw.summary !== null) {
    if (typeof raw.summary !== "string") add("summary", "must be text")
    else if (raw.summary.trim().length > OUTPUT_LIMITS.maxSummaryLength) add("summary", `must be at most ${OUTPUT_LIMITS.maxSummaryLength} characters`)
    else summary = raw.summary.trim()
  }

  // outputs
  const outputs: Record<string, OutputValues> = {}
  if (!isPlainObject(raw.outputs)) {
    add("outputs", "is required and must be an object with one entry per scenario id")
  } else {
    const given = raw.outputs
    const ids = spec.scenarios.map((s) => s.id)
    const unknown = Object.keys(given).filter((k) => !ids.includes(k))
    for (const id of unknown.slice(0, 5)) add(`outputs.${id}`, "is not a scenario of this specialist")
    if (unknown.length > 5) add("outputs", `${unknown.length - 5} more unknown scenario ids not listed`)

    const missing = ids.filter((id) => !has(given, id))
    if (missing.length > 0) {
      add("outputs", `is missing ${missing.length} scenario${missing.length === 1 ? "" : "s"}: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? ", …" : ""}`)
    }

    const fieldNames = spec.outputFields.map((f) => f.name)
    for (const id of ids) {
      if (!has(given, id)) continue
      const entry = given[id]
      const path = `outputs.${id}`
      if (!isPlainObject(entry)) {
        add(path, "must be an object of values by output field")
        continue
      }
      for (const key of Object.keys(entry)) {
        if (!fieldNames.includes(key) || !ID_PATTERN.test(key)) add(`${path}.${key}`, `is not an output field of this specialist (${fieldNames.join(", ")})`)
      }
      const values: OutputValues = {}
      for (const field of fieldNames) {
        const value = has(entry, field) ? entry[field] : undefined
        if (value === undefined || value === null) {
          add(`${path}.${field}`, "is missing")
        } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          const t = String(value)
          if (t.length > OUTPUT_LIMITS.maxValueLength) add(`${path}.${field}`, `must be at most ${OUTPUT_LIMITS.maxValueLength} characters`)
          else values[field] = t
        } else {
          add(`${path}.${field}`, "must be text, a number or true/false")
        }
      }
      outputs[id] = values
    }
  }

  if (errors.length > 0 || extra > 0 || version === null) return finish()
  return { ok: true, data: { version, releasedAt, summary, outputs }, isNewVersion }
}

/** An outputs file with an empty value for every field of every scenario, to fill in. */
export function outputsSkeleton(spec: Pick<SpecialistSpec, "outputFields" | "scenarios">, version = "v1"): string {
  const outputs = Object.fromEntries(spec.scenarios.map((s) => [s.id, Object.fromEntries(spec.outputFields.map((f) => [f.name, ""]))]))
  return JSON.stringify({ format: OUTPUTS_FORMAT, version, releasedAt: "", summary: "", outputs }, null, 2)
}
