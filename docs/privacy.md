---
title: Signett Agent Privacy Policy
description: Privacy policy for the Signett Agent Chrome extension.
---

# Signett Agent privacy policy

**Effective date:** September 7, 2026

This policy applies to the **Signett Agent** Chrome extension. Signett Agent has
one purpose: to let a user inspect and invoke the WebMCP tools exposed by the
active page through a model provider the user configures.

## Information the extension handles

Signett Agent handles the following information only to provide its stated
functionality:

- **Active page information.** The active page's title and URL are processed
  locally so the extension can connect its side panel to the current tab. They
  are not sent to the configured model provider.
- **WebMCP data.** The extension reads the names, descriptions, input schemas,
  and results of WebMCP tools that the active page explicitly exposes. It does
  not read page DOM content, cookies, browsing history, or screenshots.
- **Prompts and conversations.** When the user starts or continues a run, the
  user's prompt, WebMCP tool definitions, relevant prior conversation turns,
  and tool results are sent directly to the model endpoint selected by the
  user.
- **Model settings and credentials.** The selected provider, endpoint, and
  model name are stored locally in Chrome. The API key is stored in
  `chrome.storage.session` by default. It is stored in Chrome's unencrypted
  local extension storage only if the user explicitly enables **Remember on
  this device**.
- **Optional personal information.** A name, email address, and postal address
  may be entered in Settings. These fields are optional and are stored in
  Chrome's local extension storage. Non-empty fields are included in the
  context sent to the selected model provider at the start of each
  conversation.

## How information is used

The extension uses this information solely to:

- show the WebMCP tools available on the active page;
- ask the user's selected model provider to choose among those tools;
- invoke the selected page-provided tools;
- display tool calls, results, and model responses; and
- retain the active conversation long enough to support follow-up turns.

Signett does not operate a backend for this extension and does not receive,
collect, sell, or use extension data for advertising, profiling, credit
decisions, or unrelated analytics.

## Sharing and transfers

When the user starts a run, prompts, WebMCP tool definitions, relevant
conversation history, tool results, and any non-empty optional personal fields
are sent directly to the model provider configured by the user. The configured
provider processes that information under its own privacy terms.

Signett Agent does not transfer this information to Signett or to advertising
platforms, data brokers, or information resellers. Signett personnel cannot
read the information handled by the extension because Signett does not receive
it.

## Storage, retention, and deletion

- The active conversation is stored only in `chrome.storage.session`. It is
  cleared when the user selects **New conversation** or when Chrome or the
  extension restarts.
- The provider, endpoint, model name, and optional personal fields remain in
  Chrome's local extension storage until the user edits or clears them or
  removes the extension.
- The API key remains in session storage by default. If **Remember on this
  device** is enabled, it remains in local extension storage until the user
  disables that option, clears the key, or removes the extension.

## Website and provider access

Website access is optional and requested through Chrome's permission prompt.
It allows Signett Agent to check ordinary HTTP and HTTPS pages for WebMCP tools
as the user navigates. Access to a model-provider origin is also requested only
when that endpoint is configured or used.

Remote provider traffic must use HTTPS. Plain HTTP is accepted only for local
loopback development endpoints such as `localhost` and `127.0.0.1`.

## Chrome Web Store Limited Use

Signett Agent's use and transfer of information complies with the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data),
including the Limited Use requirements. Information is handled only as needed
to provide the extension's disclosed single purpose.

## Changes to this policy

If Signett Agent's data practices change, this policy and the extension's
Chrome Web Store disclosures will be updated before the changed practices are
introduced.

## Contact

Privacy questions may be sent through the publisher contact shown on the
Signett Agent Chrome Web Store listing. Security issues can be reported through
[GitHub private vulnerability reporting](https://github.com/signettai/signett/security/advisories/new).

