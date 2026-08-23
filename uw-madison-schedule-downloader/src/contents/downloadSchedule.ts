import fileDownload from "js-file-download";
import type { PlasmoCSConfig } from "plasmo";
import browser from "webextension-polyfill";

import { DOWNLOAD_SHED_MSG, GET_INFO_MSG } from "~assets/constants";
import type { AppMessage } from "~types";
import { buildIcs, extractData, TERMS } from "~util/buildIcs";

export const config: PlasmoCSConfig = {
  matches: ["*://mumaaenroll.services.wisc.edu/courses-schedule*"]
};

browser.runtime.onMessage.addListener((message: AppMessage) => {
  // Popup asks for term name + default start date to prefill the date field.
  if (message.type === GET_INFO_MSG) {
    const data = extractData(document.documentElement.outerHTML);
    if (!data) return Promise.resolve({ found: false });
    const termName = (data.terms?.available || []).reduce(
      (acc: string, t: any) => (t.code === data.termCode ? t.name : acc),
      data.termCode
    );
    return Promise.resolve({
      found: true,
      termName,
      defaultStart: TERMS[data.termCode]?.firstClass || ""
    });
  }

  if (message.type !== DOWNLOAD_SHED_MSG) return;

  const data = extractData(document.documentElement.outerHTML);
  if (!data) {
    alert("Couldn't read your schedule on this page. Select a term with courses, then try again.");
    return;
  }

  const { ics, warnings, termName } = buildIcs(data, {
    firstClass: message.payload?.firstClass
  });
  if (warnings.length) {
    console.warn(warnings.join("\n"));
    alert(warnings.join("\n\n"));
  }

  fileDownload(ics, `uw-${termName.replace(/\s+/g, "-").toLowerCase()}.ics`);
});
