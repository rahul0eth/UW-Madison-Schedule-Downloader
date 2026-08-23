# UW-Madison Schedule Downloader — Improved

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-FFDD00?style=flat-square&logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/rahul121)

A Chrome extension that exports your UW–Madison class schedule to a `.ics` file you can import
into Google Calendar, Apple Calendar, Outlook, and others.

This is an improved fork of [**UW-Madison-Schedule-Downloader** by Max Maeder](https://github.com/MaxMaeder/UW-Madison-Schedule-Downloader)
([original Chrome Web Store listing](https://chrome.google.com/webstore/detail/uw-madison-schedule-downl/jhidpigegcjbdjbdapojjnckgodpdlfh)).
All credit for the original extension goes to Max — this fork fixes the calendar output.

## What's better

The original exported events that repeated **forever**, landed on the **current** week regardless
of term, and omitted final exams. This fork rewrites the ICS generation:

| Fix | Detail |
|---|---|
| **Semester-bounded** | Events stop on the term's last class day (`RRULE …;UNTIL=`) instead of repeating forever. |
| **Correct term dates** | Classes start on the real first day of instruction, not the week you happened to click download. |
| **Final exams included** | Each course's final is exported as a real dated event, pulled from the schedule page. |
| **Color coded** | Every course keeps the color UW assigns it on the schedule site. |
| **Holidays excluded** | Labor Day and Thanksgiving recess are skipped via `EXDATE` (computed, not hardcoded). |
| **Correct timezone** | Proper `America/Chicago` `VTIMEZONE`, so CST/CDT transitions don't shift your classes. |
| **Editable start date** | Set the first day of classes in the popup if your term isn't built in. |
| **Rooms & sections** | Building/room as `LOCATION`, course title and section in the description. |

### How it works

The original scraped the rendered DOM. This version reads the JSON the schedule page already
embeds to bootstrap its own calendar, which carries course colors, meeting days/times, sections,
and real final-exam dates — more accurate and far less fragile.

Semester boundaries aren't in that JSON, so they come from the
[UW–Madison academic calendar](https://secfac.wisc.edu/academic-calendar/) (`TERMS` in
`src/util/buildIcs.ts`) and can be overridden in the popup.

## Install (unpacked)

1. Download/clone this repo and build it (below), or grab the zip from
   [Releases](https://github.com/rahul0eth/UW-Madison-Schedule-Downloader/releases).
2. Go to `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select `build/chrome-mv3-prod`.

## Usage

1. Open your [Course Schedule](https://mumaaenroll.services.wisc.edu/courses-schedule/) and pick a term.
2. Click the extension icon.
3. Confirm the **first day of classes**, then hit **Download Schedule**.
4. Import the `.ics` into your calendar.

> **Note:** Google Calendar ignores per-event colors on ICS import and colors the whole imported
> calendar as one. Apple Calendar and Thunderbird honor the per-course colors.

## Development

```bash
pnpm install
pnpm dev     # load build/chrome-mv3-dev as an unpacked extension
pnpm build   # production build -> build/chrome-mv3-prod
pnpm package # zip for the Chrome Web Store
```

### Adding a future term

Add its dates from the [academic calendar](https://secfac.wisc.edu/academic-calendar/) to `TERMS`
in `src/util/buildIcs.ts`:

```ts
"1274": { firstClass: "2027-01-19", lastClass: "2027-04-30" } // Spring 2027
```

Terms that aren't listed still work — enter the start date in the popup, and the end date is
estimated from finals week.

### Known gaps

- Spring recess isn't excluded yet (only Labor Day, Thanksgiving, and MLK are computed).
- Online/asynchronous classes have no meeting time, so only their final exam is exported.

## Support

This is free and always will be. If it saved you some calendar wrangling, you can
[buy me a coffee](https://buymeacoffee.com/rahul121) — entirely optional.

## Credit

Original extension by **[Max Maeder](https://mmaeder.com)** —
[MaxMaeder/UW-Madison-Schedule-Downloader](https://github.com/MaxMaeder/UW-Madison-Schedule-Downloader).
Calendar-output improvements by **[Rahul Bajaj](https://github.com/rahul0eth)**.
