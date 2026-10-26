import type { Split } from "./types"

/**
 * The format a team uses to describe its specialist, and the validation that guards it.
 * See specs/2026-10-26-phase-10-self-serve-onboarding/requirements.md for the full rules.
 *
 * Everything here is pure. A config arrives as untrusted text, so every level is checked
 * strictly: sizes, counts, key patterns (no prototype pollution), unknown properties, and
 * the references between parts. Errors name the exact place.
 */

export const SPEC_FORMAT = "agentclinic.specialist/1"

export const LIMITS = {
  maxBytes: 200 * 1024,
  maxFields: 10,
  maxChecks: 40,
  maxThemes: 20,
  maxScenarios: 200,
  maxInputLength: 2000,
  maxNameLength: 80,
  maxDescriptionLength: 500,
  maxWhyLength: 300,
  maxSlugLength: 40,
  maxOneOfValues: 50,
  maxValueLength: 200,
  /** A bad file can have thousands of problems; show the first of them. */
  maxErrors: 25,
} as const

/** Field names, theme ids, scenario ids and reference list names. */
export const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Names that would be harmful or confusing as object keys. */
const RESERVED_NAMES = ["constructor", "prototype", "tostring", "hasownproperty", "valueof"]
/** Slugs that are page routes, which a specialist's address must not shadow. */
const RESERVED_SLUGS = ["new", "edit", "import"]

export type OutputField = { name: string; description: string }

export type Check =
  | { field: string; type: "equals" }
  | { field: string; type: "oneOf"; values: string[] }
  | { field: string; type: "inReference"; list: string }
  | { field: string; type: "nonEmpty" }

export type CheckType = Check["type"]
export const CHECK_TYPES: CheckType[] = ["equals", "oneOf", "inReference", "nonEmpty"]

export type ThemeDef = { id: string; label: string; description: string }

export type Weight = 1 | 2 | 3

export type ScenarioSpec = {
  id: string
  split: Split
  theme: string
  /** How much a failure of this scenario matters, 1 (low) to 3 (high). */
  weight: Weight
  input: string
  /** Expected values by output field name, as text. */
  expected: Record<string, string>
  why: string
}

export type JudgeSpec = { field: string }

export type SpecialistSpec = {
  slug: string
  name: string
  description: string
  outputFields: OutputField[]
  checks: Check[]
  themes: ThemeDef[]
  judge: JudgeSpec | null
  scenarios: ScenarioSpec[]
}

export type ValidationError = { path: string; message: string }

export type ValidationResult =
  | { ok: true; spec: SpecialistSpec }
  | { ok: false; errors: ValidationError[] }

/* ───────────────────────── helpers ───────────────────────── */

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

const isReservedName = (name: string) => RESERVED_NAMES.includes(name.toLowerCase().replace(/^_+|_+$/g, ""))

const quote = (s: string) => JSON.stringify(s.length > 40 ? s.slice(0, 40) + "…" : s)

const list = (items: string[], max = 8) =>
  items.length <= max ? items.join(", ") : `${items.slice(0, max).join(", ")}, …`

/** Collects errors up to the cap, so a very bad file cannot produce a very large response. */
class Errors {
  items: ValidationError[] = []
  extra = 0
  add(path: string, message: string) {
    if (this.items.length < LIMITS.maxErrors) this.items.push({ path, message })
    else this.extra++
  }
  result(): ValidationError[] {
    return this.extra > 0
      ? [...this.items, { path: "", message: `…and ${this.extra} more problem${this.extra === 1 ? "" : "s"} not shown.` }]
      : this.items
  }
  get any() {
    return this.items.length > 0
  }
}

/** Rejects properties the format does not define: a typo should be an error, not silently ignored. */
function checkKeys(obj: Record<string, unknown>, allowed: string[], path: string, errors: Errors) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      errors.add(path ? `${path}.${key}` : key, `is not a recognised property (allowed: ${allowed.join(", ")})`)
    }
  }
}

function readString(
  value: unknown,
  path: string,
  errors: Errors,
  opts: { min?: number; max: number; optional?: boolean; fallback?: string }
): string | null {
  if (value === undefined || value === null) {
    if (opts.optional) return opts.fallback ?? ""
    errors.add(path, "is required")
    return null
  }
  if (typeof value !== "string") {
    errors.add(path, "must be text")
    return null
  }
  const text = value.trim()
  if (text.length < (opts.min ?? 0)) {
    errors.add(path, opts.min === 1 ? "must not be empty" : `must be at least ${opts.min} characters`)
    return null
  }
  if (text.length > opts.max) {
    errors.add(path, `must be at most ${opts.max} characters (it is ${text.length})`)
    return null
  }
  return text
}

function readId(value: unknown, path: string, what: string, errors: Errors): string | null {
  if (typeof value !== "string") {
    errors.add(path, `${what} is required and must be text`)
    return null
  }
  if (!ID_PATTERN.test(value)) {
    errors.add(
      path,
      `${quote(value)} is not a valid ${what}: use a letter first, then letters, digits, - or _, up to 40 characters`
    )
    return null
  }
  if (isReservedName(value)) {
    errors.add(path, `${quote(value)} is a reserved name and cannot be used as a ${what}`)
    return null
  }
  return value
}

/* ───────────────────────── validation ───────────────────────── */

export function validateSpecialistConfig(text: string): ValidationResult {
  const errors = new Errors()

  if (typeof text !== "string" || text.trim() === "") {
    return { ok: false, errors: [{ path: "", message: "The config is empty. Paste or upload a JSON document." }] }
  }
  const bytes = new TextEncoder().encode(text).length
  if (bytes > LIMITS.maxBytes) {
    return {
      ok: false,
      errors: [{ path: "", message: `The config is ${Math.ceil(bytes / 1024)} KB, over the ${LIMITS.maxBytes / 1024} KB limit.` }],
    }
  }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown error"
    return { ok: false, errors: [{ path: "", message: `This is not valid JSON: ${detail}` }] }
  }
  if (!isPlainObject(raw)) {
    return { ok: false, errors: [{ path: "", message: "The config must be a JSON object, not a list or a single value." }] }
  }

  checkKeys(raw, ["format", "slug", "name", "description", "outputFields", "checks", "themes", "judge", "scenarios"], "", errors)

  if (raw.format !== SPEC_FORMAT) {
    errors.add("format", `must be ${JSON.stringify(SPEC_FORMAT)}${raw.format === undefined ? " (it is missing)" : ""}`)
  }

  // slug, name, description
  let slug: string | null = null
  if (typeof raw.slug !== "string") errors.add("slug", "is required and must be text")
  else if (raw.slug.length > LIMITS.maxSlugLength || !SLUG_PATTERN.test(raw.slug)) {
    errors.add("slug", `${quote(raw.slug)} is not a valid slug: use lowercase letters, digits and single hyphens, up to ${LIMITS.maxSlugLength} characters`)
  } else if (RESERVED_SLUGS.includes(raw.slug)) {
    errors.add("slug", `${quote(raw.slug)} is reserved because it is a page address; choose another`)
  } else slug = raw.slug
  const name = readString(raw.name, "name", errors, { min: 1, max: LIMITS.maxNameLength })
  const description = readString(raw.description, "description", errors, {
    max: LIMITS.maxDescriptionLength,
    optional: true,
  })

  // output fields
  const outputFields: OutputField[] = []
  const fieldNames: string[] = []
  if (!Array.isArray(raw.outputFields) || raw.outputFields.length === 0) {
    errors.add("outputFields", "must be a list with at least one field")
  } else if (raw.outputFields.length > LIMITS.maxFields) {
    errors.add("outputFields", `has ${raw.outputFields.length} fields; the limit is ${LIMITS.maxFields}`)
  } else {
    raw.outputFields.forEach((f, i) => {
      const path = `outputFields[${i}]`
      if (!isPlainObject(f)) return errors.add(path, "must be an object with a name")
      checkKeys(f, ["name", "description"], path, errors)
      const fname = readId(f.name, `${path}.name`, "field name", errors)
      const fdesc = readString(f.description, `${path}.description`, errors, { max: LIMITS.maxDescriptionLength, optional: true })
      if (fname === null) return
      if (fieldNames.includes(fname)) return errors.add(`${path}.name`, `${quote(fname)} is used twice`)
      fieldNames.push(fname)
      outputFields.push({ name: fname, description: fdesc ?? "" })
    })
  }

  // checks
  const checks: Check[] = []
  if (!Array.isArray(raw.checks) || raw.checks.length === 0) {
    errors.add("checks", "must be a list with at least one check")
  } else if (raw.checks.length > LIMITS.maxChecks) {
    errors.add("checks", `has ${raw.checks.length} checks; the limit is ${LIMITS.maxChecks}`)
  } else {
    raw.checks.forEach((c, i) => {
      const path = `checks[${i}]`
      if (!isPlainObject(c)) return errors.add(path, "must be an object with a field and a type")
      const type = c.type
      if (typeof type !== "string" || !CHECK_TYPES.includes(type as CheckType)) {
        return errors.add(`${path}.type`, `must be one of ${CHECK_TYPES.join(", ")}`)
      }
      checkKeys(c, type === "oneOf" ? ["field", "type", "values"] : type === "inReference" ? ["field", "type", "list"] : ["field", "type"], path, errors)
      if (typeof c.field !== "string") return errors.add(`${path}.field`, "is required and must be text")
      if (!fieldNames.includes(c.field)) {
        return errors.add(`${path}.field`, `${quote(c.field)} is not one of the output fields (${list(fieldNames) || "none defined"})`)
      }
      if (type === "oneOf") {
        const values = c.values
        if (!Array.isArray(values) || values.length === 0 || values.length > LIMITS.maxOneOfValues) {
          return errors.add(`${path}.values`, `must be a list of 1 to ${LIMITS.maxOneOfValues} allowed values`)
        }
        const texts = values.map((v) => (typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v).trim() : null))
        if (texts.some((t) => t === null || t === "" || t.length > LIMITS.maxValueLength)) {
          return errors.add(`${path}.values`, `must contain only non-empty text, numbers or true/false, each up to ${LIMITS.maxValueLength} characters`)
        }
        checks.push({ field: c.field, type, values: texts as string[] })
      } else if (type === "inReference") {
        const listName = readId(c.list, `${path}.list`, "reference list name", errors)
        if (listName !== null) checks.push({ field: c.field, type, list: listName })
      } else {
        checks.push({ field: c.field, type: type as "equals" | "nonEmpty" })
      }
    })
  }

  // themes
  const themes: ThemeDef[] = []
  const themeIds: string[] = []
  if (!Array.isArray(raw.themes) || raw.themes.length === 0) {
    errors.add("themes", "must be a list with at least one theme")
  } else if (raw.themes.length > LIMITS.maxThemes) {
    errors.add("themes", `has ${raw.themes.length} themes; the limit is ${LIMITS.maxThemes}`)
  } else {
    raw.themes.forEach((t, i) => {
      const path = `themes[${i}]`
      if (!isPlainObject(t)) return errors.add(path, "must be an object with an id and a label")
      checkKeys(t, ["id", "label", "description"], path, errors)
      const id = readId(t.id, `${path}.id`, "theme id", errors)
      const label = readString(t.label, `${path}.label`, errors, { min: 1, max: LIMITS.maxNameLength })
      const desc = readString(t.description, `${path}.description`, errors, { max: LIMITS.maxDescriptionLength, optional: true })
      if (id === null || label === null) return
      if (themeIds.includes(id)) return errors.add(`${path}.id`, `${quote(id)} is used twice`)
      themeIds.push(id)
      themes.push({ id, label, description: desc ?? "" })
    })
  }

  // judge
  let judge: JudgeSpec | null = null
  if (raw.judge !== undefined && raw.judge !== null) {
    if (!isPlainObject(raw.judge)) errors.add("judge", "must be an object with a field, or left out")
    else {
      checkKeys(raw.judge, ["field"], "judge", errors)
      if (typeof raw.judge.field !== "string" || !fieldNames.includes(raw.judge.field)) {
        errors.add("judge.field", `must be one of the output fields (${list(fieldNames) || "none defined"})`)
      } else judge = { field: raw.judge.field }
    }
  }

  // scenarios
  const scenarios: ScenarioSpec[] = []
  const scenarioIds: string[] = []
  const equalsFields = checks.filter((c) => c.type === "equals").map((c) => c.field)
  if (!Array.isArray(raw.scenarios) || raw.scenarios.length === 0) {
    errors.add("scenarios", "must be a list with at least one scenario")
  } else if (raw.scenarios.length > LIMITS.maxScenarios) {
    errors.add("scenarios", `has ${raw.scenarios.length} scenarios; the limit is ${LIMITS.maxScenarios}`)
  } else {
    raw.scenarios.forEach((s, i) => {
      const path = `scenarios[${i}]`
      if (!isPlainObject(s)) return errors.add(path, "must be an object")
      checkKeys(s, ["id", "split", "theme", "weight", "input", "expected", "why"], path, errors)

      const id = readId(s.id, `${path}.id`, "scenario id", errors)
      if (id !== null) {
        if (scenarioIds.includes(id)) errors.add(`${path}.id`, `${quote(id)} is used twice`)
        else scenarioIds.push(id)
      }

      let split: Split | null = null
      if (s.split === "DEV" || s.split === "HOLDOUT") split = s.split
      else errors.add(`${path}.split`, 'must be "DEV" or "HOLDOUT"')

      let theme: string | null = null
      if (typeof s.theme !== "string") errors.add(`${path}.theme`, "is required and must be text")
      else if (!themeIds.includes(s.theme)) {
        errors.add(`${path}.theme`, `${quote(s.theme)} is not one of the themes (${list(themeIds) || "none defined"})`)
      } else theme = s.theme

      let weight: Weight | null = 1
      if (s.weight !== undefined) {
        if (s.weight === 1 || s.weight === 2 || s.weight === 3) weight = s.weight
        else {
          weight = null
          errors.add(`${path}.weight`, "must be 1, 2 or 3 (how much a failure matters), or left out for 1")
        }
      }

      const input = readString(s.input, `${path}.input`, errors, { min: 1, max: LIMITS.maxInputLength })
      const why = readString(s.why, `${path}.why`, errors, { max: LIMITS.maxWhyLength, optional: true })

      const expected: Record<string, string> = {}
      let expectedOk = true
      if (!isPlainObject(s.expected)) {
        errors.add(`${path}.expected`, "is required and must be an object of expected values by field")
        expectedOk = false
      } else {
        for (const [key, value] of Object.entries(s.expected)) {
          if (!fieldNames.includes(key)) {
            errors.add(`${path}.expected.${key}`, `is not one of the output fields (${list(fieldNames) || "none defined"})`)
            expectedOk = false
          } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            const text = String(value).trim()
            if (text.length > LIMITS.maxValueLength) {
              errors.add(`${path}.expected.${key}`, `must be at most ${LIMITS.maxValueLength} characters`)
              expectedOk = false
            } else expected[key] = text
          } else {
            errors.add(`${path}.expected.${key}`, "must be text, a number or true/false")
            expectedOk = false
          }
        }
        for (const field of equalsFields) {
          if (expected[field] === undefined || expected[field] === "") {
            if (expectedOk) errors.add(`${path}.expected.${field}`, `is required because ${field} is checked with "equals"`)
            expectedOk = false
          }
        }
      }

      if (id && split && theme && weight && input !== null && expectedOk) {
        scenarios.push({ id, split, theme, weight, input, expected, why: why ?? "" })
      }
    })
    if (!raw.scenarios.some((s) => isPlainObject(s) && s.split === "DEV")) {
      errors.add("scenarios", "needs at least one scenario with split DEV")
    }
  }

  if (errors.any || slug === null || name === null || description === null) {
    return { ok: false, errors: errors.result() }
  }
  return { ok: true, spec: { slug, name, description, outputFields, checks, themes, judge, scenarios } }
}
