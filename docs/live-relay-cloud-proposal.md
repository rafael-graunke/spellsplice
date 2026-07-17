# Live Mode Cross-Browser Relay: Cloud Proposal

Status: **Proposed** (not implemented). Current shipped behavior is localhost-only (see "Current state" below).

## Problem

Live Mode needs real-time, one-way-ish state sync from the **controller** (runs in the
user's default browser) to the **/overlay** (runs inside OBS's Browser Source). OBS's
Browser Source is Chromium Embedded (CEF) with its own **isolated profile** — a separate
process with separate storage.

Every same-browser channel dies at that boundary:

- BroadcastChannel, `localStorage` `storage` events, SharedWorker, IndexedDB, Cache API
  are all profile-scoped. None reach OBS.
- File System Access / `file://` — OBS can't run the picker prompt; the controller browser
  can't write arbitrary files. Dead.

The two pages can therefore only meet over the **network**. The only real decision is
*where that meeting point lives*.

## Current state (shipped)

Local Python relay (`public/spellsplice-relay.py`), **bound to `127.0.0.1` only**.
Controller, relay, and OBS must all run on the **same machine**, connecting over
`ws://localhost:8765`.

Why localhost-only:

- Browsers treat `localhost` / loopback as "potentially trustworthy", so a plaintext
  `ws://localhost` connection from an HTTPS page is **not** mixed content — badge stays
  clean, connection allowed.
- A `ws://<LAN-IP>` connection from an HTTPS page **is** mixed content: the browser
  downgrades the whole document to "Not secure" (for the lifetime of the page load, across
  all SPA routes) and deprecates/blocks the connection. No app-side override can keep the
  badge clean — it's the browser's decision, tied to the request attempt itself.

Guards in place to enforce this:

- `isMixedContentWs(url)` in `src/lib/liveMode.ts` — true when page is HTTPS **and** URL is
  `ws://` **and** host is non-loopback.
- `useLiveModeSocket` skips auto-connect when `isMixedContentWs` is true (prevents silent
  badge downgrade on Live Mode load from a stale stored URL).
- `ConnectionSection` shows a warning banner and disables Test/Start for a mixed-content URL,
  steering users to `ws://localhost` or a `wss://` tunnel.

Consequence: the two-machine LAN setup (OBS on a second PC) is no longer supported by the
local relay. That path requires the cloud relay below.

## Proposal: Cloudflare Durable Object relay

Move the relay to the cloud so it's reachable over `wss://` (no mixed content, badge clean,
works cross-machine). One **Durable Object instance per room**; it holds the WebSocket
connections and fans out messages. Reuse existing `LiveMessage` shapes.

Chosen over managed pub/sub (Ably/Pusher) and Supabase Realtime because:

- **Free at our scale, self-owned, no third-party dependency.** Durable Objects are on the
  Workers Free plan.
- Natural fit if/when app.spellsplice.com migrates to Cloudflare (considered for analytics
  anyway). Currently on GitHub Pages.
- Supabase free tier rejected: free projects pause after ~1 week idle → dead relay for a
  streamer returning after a quiet stretch.

### Pairing mechanism

Controller mints a short **room code**, baked into the overlay URL the user already pastes
into OBS: `/overlay?room=AB12CD` (replaces today's `?ws=` param). Both sides rendezvous on
that room. Fixes cross-machine for free.

### Non-negotiable design constraints (cost-critical)

1. **Use the WebSocket Hibernation API.** Duration is billed as memory (128 MB = 0.125 GB) ×
   wall-clock the DO is awake. Without hibernation a 1-hour connection = ~450 GB-s. With
   hibernation the DO sleeps between messages → ~0 GB-s. At 10k daily streamers this is the
   difference between **~$10/mo and ~$3,400/mo**.
2. **Do not persist state to SQLite per message.** Free tier allows 100k row-writes/day; a
   naive write-per-message (~1,000/session) caps you at ~100 sessions/day. Store a single
   coalesced/debounced "latest state" snapshot (so a late-joining overlay catches up), or
   skip persistence entirely.

## Pricing analysis (Cloudflare DO, verified against pricing page)

### Limits

| | Free (daily) | Paid $5/mo (monthly incl.) | Overage |
|---|---|---|---|
| Requests | 100,000 / day | 1,000,000 / mo | $0.15 / million |
| Duration | 13,000 GB-s / day | 400,000 GB-s / mo | $12.50 / million GB-s |
| Rows written | 100,000 / day | 50M / mo | $1.00 / million |
| Rows read | 5M / day | 25B / mo | $0.001 / million |
| Storage | 5 GB total | 5 GB-mo | $0.20 / GB-mo |

**Free plan has no overage — it errors at the cap.** Going over requires the Paid plan
($5/mo minimum, overages on top).

### WebSocket billing quirks

- Connection = 1 request.
- Incoming messages billed **20:1** (20 controller→relay msgs = 1 billable request).
  Outgoing (relay→overlay) is free.
- Duration only accrues while the DO is awake → hibernation drives it to ~0.

### Per-session footprint (hibernation ON, 2 clients, ~1,000 controller msgs/session)

- Requests: 2 connects + 1000÷20 ≈ **~52 billable requests/session**
- Duration: sub-1 GB-s (negligible)
- Rows: negligible (coalesced snapshot only)

### What it takes to exceed FREE

Binding constraint = 100k requests/day → 100,000 ÷ ~52 ≈ **~1,900 game-sessions/day**,
roughly **500–900 daily-active streamers on the same day**. Effectively years away.

### What you'd pay OVER the limit

Scenario: **10,000 daily-active streamers, 2 sessions each, 30 days** = 600,000 sessions/mo.

- With hibernation: requests 31.2M/mo → overage 30.2M × $0.15/M = $4.53. Duration ~$0.
  **Total ≈ $5 base + $4.53 ≈ ~$9.50/mo.**
- Without hibernation: duration 270M GB-s → overage ~$3,370/mo. (Why hibernation is
  non-negotiable.)

### Bottom line

Free tier survives until the app is genuinely popular. Even at 10k daily streamers the paid
cost is ~$10/mo, dominated by the $5 minimum — *if and only if* hibernation is used and
SQLite isn't written per message. Cost risk is a design mistake, not scale.

## Implementation sketch (when picked up)

- Cloudflare Worker + Durable Object class, one instance per room code.
- Hibernation-based WebSocket handlers (`state.acceptWebSocket`, `webSocketMessage`,
  `webSocketClose`).
- Optional coalesced latest-state snapshot in DO storage for late joiners.
- Client: swap `useLiveModeSocket(url)` for `useLiveModeChannel(roomId)` connecting to
  `wss://<worker-host>/room/<code>`; keep `LiveMessage` shapes unchanged.
- Overlay URL param `?ws=` → `?room=`; update `buildOverlayUrl` / `resolveOverlayWebsocketUrl`.
- Keep the local Python relay as the offline/localhost fallback.

## References

- Cloudflare DO pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/
- WebSocket Hibernation API: https://developers.cloudflare.com/durable-objects/api/websockets/
