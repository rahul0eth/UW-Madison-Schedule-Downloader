/**
 * UW-Madison schedule JSON -> ICS. Pure, no DOM.
 *
 * Source is the `const data = {...}` blob the schedule page embeds to bootstrap
 * its calendar — it carries courses, colors, meeting days/times, sections and
 * real final-exam dates, so we don't scrape the (fragile) rendered DOM.
 *
 * Semester START comes from the user (the page doesn't contain it); we prefill
 * a known default per term. Semester END is derived from the finals week that
 * IS in the page (classes stop the day before the earliest final). Holidays
 * (Labor Day / Thanksgiving / MLK) are computed, so nothing is hardcoded to rot.
 */

// Known term boundaries from https://secfac.wisc.edu/academic-calendar/ .
// firstClass is only a prefill the user can override. lastClass is the exact
// last class day; when a term isn't listed we fall back to deriving the end
// from the finals week in the page (slightly generous — see below).
type TermDates = { firstClass: string; lastClass: string };
export const TERMS: Record<string, TermDates> = {
  "1272": { firstClass: "2026-09-02", lastClass: "2026-12-09" } // Fall 2026 (Wed–Wed)
};

const DAY: Record<string, string> = { M: "MO", T: "TU", W: "WE", R: "TH", F: "FR", S: "SA", U: "SU" };
const BYDAY_TO_DOW: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:America/Chicago",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0600", "TZOFFSETTO:-0500", "TZNAME:CDT",
  "DTSTART:19700308T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0500", "TZOFFSETTO:-0600", "TZNAME:CST",
  "DTSTART:19701101T020000", "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE"
];

const pad = (n: number) => (n < 10 ? "0" + n : "" + n);
const ymd = (s: string) => s.slice(0, 10).replace(/-/g, "");
const hms = (s: string) => s.slice(11, 19).replace(/:/g, "");
const toKey = (d: Date) => "" + d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());
const parseDay = (s: string) => { const p = s.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); };

const escapeText = (s: any) =>
  String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const fold = (line: string) => {
  if (line.length <= 74) return line;
  let out = line.slice(0, 74), rest = line.slice(74);
  while (rest.length) { out += "\r\n " + rest.slice(0, 73); rest = rest.slice(73); }
  return out;
};

const daysFromInitials = (s: string) => [...s].map((c) => DAY[c]).filter(Boolean);

// nth <weekday> of a month, e.g. nthWeekday(2026, 8, 1, 1) = 1st Monday of Sep (month is 0-based)
const nthWeekday = (year: number, month0: number, dow: number, n: number) => {
  const first = new Date(Date.UTC(year, month0, 1));
  let day = 1 + ((dow - first.getUTCDay() + 7) % 7) + (n - 1) * 7;
  return new Date(Date.UTC(year, month0, day));
};

// Algorithmic UW holidays with no classes, for the year(s) a term spans.
const holidaysFor = (year: number): Date[] => {
  const laborDay = nthWeekday(year, 8, 1, 1);        // 1st Mon Sep
  const thanksThu = nthWeekday(year, 10, 4, 4);      // 4th Thu Nov
  const thanksFri = new Date(thanksThu); thanksFri.setUTCDate(thanksThu.getUTCDate() + 1);
  const mlk = nthWeekday(year, 0, 1, 3);             // 3rd Mon Jan
  return [laborDay, thanksThu, thanksFri, mlk];
};

const firstOccurrence = (start: Date, byday: string[]) => {
  const wanted = byday.map((d) => BYDAY_TO_DOW[d]);
  const d = new Date(start);
  for (let i = 0; i < 7; i++) {
    if (wanted.includes(d.getUTCDay())) return toKey(d);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return toKey(start);
};

const vevent = (fields: (string | "")[]) =>
  ["BEGIN:VEVENT", ...fields.filter(Boolean).map(fold), "END:VEVENT"].join("\r\n");

export interface BuildOpts {
  firstClass?: string; // "YYYY-MM-DD"; overrides the per-term default
}

export function buildIcs(data: any, opts: BuildOpts = {}): { ics: string; warnings: string[]; termName: string } {
  const warnings: string[] = [];
  const termName: string = (data.terms?.available || []).reduce(
    (acc: string, t: any) => (t.code === data.termCode ? t.name : acc),
    data.termCode
  );

  const term = TERMS[data.termCode];
  const firstClassStr = opts.firstClass || term?.firstClass || "";
  const firstClass = firstClassStr ? parseDay(firstClassStr) : null;

  // End of classes: exact last class day if we know the term; otherwise derive
  // from the finals week that's in the page (day before the earliest final).
  let untilKey = "";
  if (term) {
    untilKey = ymd(term.lastClass);
  } else {
    const examStarts: string[] = (data.courses || [])
      .flatMap((c: any) => (c.exams || []).map((e: any) => e.start))
      .filter(Boolean);
    if (examStarts.length) {
      const earliest = parseDay(examStarts.map((s) => s.slice(0, 10)).sort()[0]);
      earliest.setUTCDate(earliest.getUTCDate() - 1);
      untilKey = toKey(earliest);
      warnings.push("This term isn't in the built-in list, so the class end date was estimated from finals week and may include a few study-week meetings. Add the term to TERMS in buildIcs.ts for an exact end date.");
    } else if (firstClass) {
      const guess = new Date(firstClass); guess.setUTCDate(guess.getUTCDate() + 105);
      untilKey = toKey(guess);
      warnings.push("No final exams found in the page, so the class end date is a ~15-week estimate.");
    }
  }

  if (!firstClass) {
    warnings.push(`No start date for term ${data.termCode} (${termName}). Enter the first day of classes and download again — final exams are still included.`);
  }

  const events: string[] = [];
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const courseById = data.courseForClassId || {};

  if (firstClass && untilKey) {
    // holiday EXDATE keys, from the years the term spans
    const years = new Set<number>([firstClass.getUTCFullYear(), +untilKey.slice(0, 4)]);
    const holidayKeys = new Set<string>();
    years.forEach((y) => holidaysFor(y).forEach((h) => {
      const k = toKey(h);
      if (k >= toKey(firstClass) && k <= untilKey) holidayKeys.add(k);
    }));

    for (const cls of data.classes || []) {
      const course = courseById[cls.id] || {};
      const label = `${course.subjectShortDesc || ""} ${course.catalogNumber || ""}`.trim();
      const summary = `${label} ${cls.type} ${cls.sectionNumber}`.trim();
      (cls.meetings || []).forEach((mtg: any, mi: number) => {
        if (!mtg.start || !mtg.dayInitials) return; // online / no fixed time
        const byday = daysFromInitials(mtg.dayInitials);
        if (!byday.length) return;
        const time = hms(mtg.start), endTime = hms(mtg.end);
        const startDate = firstOccurrence(firstClass, byday);
        const wanted = byday.map((d) => BYDAY_TO_DOW[d]);
        const exdates = [...holidayKeys].filter((k) => wanted.includes(parseDay(k.replace(/(\d{4})(\d\d)(\d\d)/, "$1-$2-$3")).getUTCDay())).sort();
        events.push(
          vevent([
            `UID:${cls.id}-${mi}@uw-madison-schedule`,
            `DTSTAMP:${dtstamp}`,
            `SUMMARY:${escapeText(summary)}`,
            `DESCRIPTION:${escapeText((course.title || "") + "\nSection " + cls.sectionNumber + " (" + cls.type + ")")}`,
            `LOCATION:${escapeText(mtg.location || "")}`,
            `DTSTART;TZID=America/Chicago:${startDate}T${time}`,
            `DTEND;TZID=America/Chicago:${startDate}T${endTime}`,
            `RRULE:FREQ=WEEKLY;BYDAY=${byday.join(",")};UNTIL=${untilKey}T235959`,
            exdates.length ? `EXDATE;TZID=America/Chicago:${exdates.map((k) => k + "T" + time).join(",")}` : "",
            course.color ? `X-APPLE-CALENDAR-COLOR:${course.color}` : "",
            label ? `CATEGORIES:${escapeText(label)}` : ""
          ])
        );
      });
    }
  }

  // Final exams (real dates; one per course)
  for (const course of data.courses || []) {
    const label = `${course.subjectShortDesc || ""} ${course.catalogNumber || ""}`.trim();
    (course.exams || []).forEach((ex: any, ei: number) => {
      if (!ex.start) return;
      const loc = ex.location && ex.location !== "Location not specified" ? ex.location : "";
      events.push(
        vevent([
          `UID:${course.id}-exam${ei}@uw-madison-schedule`,
          `DTSTAMP:${dtstamp}`,
          `SUMMARY:${escapeText("Final Exam: " + label)}`,
          `DESCRIPTION:${escapeText(course.title || "")}`,
          loc ? `LOCATION:${escapeText(loc)}` : "",
          `DTSTART;TZID=America/Chicago:${ymd(ex.start)}T${hms(ex.start)}`,
          `DTEND;TZID=America/Chicago:${ymd(ex.end)}T${hms(ex.end)}`,
          course.color ? `X-APPLE-CALENDAR-COLOR:${course.color}` : "",
          `CATEGORIES:${label ? escapeText(label) + "," : ""}Final Exam`
        ])
      );
    });
  }

  const ics =
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//uw-madison-schedule-downloader//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeText("UW-Madison " + termName)}`,
      "X-WR-TIMEZONE:America/Chicago",
      ...VTIMEZONE,
      ...events,
      "END:VCALENDAR"
    ].join("\r\n") + "\r\n";

  return { ics, warnings, termName };
}

// Pull the `const data = {...}` blob out of the page's HTML.
export function extractData(html: string): any | null {
  let m = html.match(/const\s+data\s*=\s*(\{[\s\S]*?\});\s*\n\s*loadTimeline/);
  if (!m) m = html.match(/const\s+data\s*=\s*(\{[\s\S]*?\});/);
  return m ? JSON.parse(m[1]) : null;
}
