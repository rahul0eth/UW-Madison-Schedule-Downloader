import { Anchor, AppShell, Button, Stack, Text, TextInput } from "@mantine/core";
import { IconArrowUpRight, IconDownload } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import browser from "webextension-polyfill";

import {
  DOWNLOAD_SHED_MSG,
  GET_INFO_MSG,
  SCHEDULE_SITE_HOST,
  SCHEDULE_SITE_PATH
} from "~assets/constants";
import useCurrentTabUrl from "~hooks/useCurrentTabUrl";
import isScheduleSite from "~util/isScheduleSite";

import Header from "./Header";
import { ThemeProvider } from "./theme";

const activeTab = async () =>
  (await browser.tabs.query({ active: true, currentWindow: true }))[0];

const Popup = () => {
  const currUrl = useCurrentTabUrl();
  const isShedSite = currUrl && isScheduleSite(currUrl);

  const [termName, setTermName] = useState("");
  const [startDate, setStartDate] = useState("");

  // Ask the page for the term + default start date to prefill the field.
  useEffect(() => {
    if (!isShedSite) return;
    (async () => {
      const tab = await activeTab();
      if (!tab.id) return;
      try {
        const info: any = await browser.tabs.sendMessage(tab.id, { type: GET_INFO_MSG });
        if (info?.found) {
          setTermName(info.termName || "");
          setStartDate(info.defaultStart || "");
        }
      } catch {
        /* content script not ready; user can still type a date */
      }
    })();
  }, [isShedSite]);

  const downloadSchedule = useCallback(async () => {
    const tab = await activeTab();
    if (tab.id)
      await browser.tabs.sendMessage(tab.id, {
        type: DOWNLOAD_SHED_MSG,
        payload: { firstClass: startDate || undefined }
      });
  }, [startDate]);

  const openSite = useCallback(() => {
    window.open("https://" + SCHEDULE_SITE_HOST + SCHEDULE_SITE_PATH, "_blank");
  }, []);

  return (
    <ThemeProvider withNormalizeCSS withGlobalStyles>
      <AppShell header={<Header />} w={350}>
        <Stack>
          {isShedSite ? (
            <>
              <TextInput
                type="date"
                label="First day of classes"
                description={termName ? `For ${termName}` : "Set your term's start date"}
                value={startDate}
                onChange={(e) => setStartDate(e.currentTarget.value)}
              />
              <Button leftIcon={<IconDownload />} onClick={downloadSchedule}>
                Download Schedule
              </Button>
            </>
          ) : (
            <Button leftIcon={<IconArrowUpRight />} onClick={openSite}>
              Go to Schedule Site
            </Button>
          )}
        </Stack>

        <Text c="dimmed" align="center" mt="lg" size="sm">
          Made better by{" "}
          <Anchor
            color="dimmed"
            href="https://github.com/rahul0eth/UW-Madison-Schedule-Downloader"
            target="_blank">
            Rahul Bajaj
          </Anchor>
          <br />
          Originally by{" "}
          <Anchor color="dimmed" href="https://mmaeder.com" target="_blank">
            Max Maeder
          </Anchor>
        </Text>
      </AppShell>
    </ThemeProvider>
  );
};

export default Popup;
