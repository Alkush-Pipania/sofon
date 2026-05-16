# Zenduty API Reference — Sofon Plugin

## Overview

Zenduty is an incident management platform. For Sofon (an uptime monitor), we use the
**Events API** — a fire-and-forget webhook that auto-creates and auto-resolves incidents
based on `alert_type`. No Authorization header is needed; the integration key is part of
the URL itself.

---

## What Credential the User Needs

**One value: the Integration Webhook URL**

Steps in Zenduty dashboard:
1. Teams → select team → Services → select service
2. Integrations → Add New Integration → choose **Generic Integration**
3. After creation → Configure → copy the **webhook URL**

The URL looks like:
```
https://events.zenduty.com/integration/{team_id}/generic/{integration_key}/
```

> ⚠️ The old "API Integration" type was deprecated on May 15 2025.
> Only Generic Integration should be used for new setups.

---

## Events API

### Base URL
```
https://events.zenduty.com/integration/{team_id}/generic/{integration_key}/
```

### Authentication
**None.** The integration key embedded in the URL is the auth. Do NOT add an
Authorization header — it is ignored and confuses debugging.

---

### Trigger Alert — Monitor Goes DOWN

```
POST {integration_url}
Content-Type: application/json
```

```json
{
  "alert_type": "critical",
  "message": "example.com is DOWN",
  "summary": "HTTP check failed — status 503, latency 4200ms",
  "entity_id": "<monitor-uuid>",
  "payload": {
    "status_code": "503",
    "monitor_url": "https://example.com",
    "latency_ms": "4200"
  },
  "urls": [
    {
      "link_url": "https://example.com",
      "link_text": "Affected URL"
    }
  ]
}
```

---

### Resolve Alert — Monitor Comes Back UP

Same endpoint, same `entity_id` — **only `alert_type` changes to `"resolved"`**.
Zenduty uses `entity_id` to find and close the open incident.

```json
{
  "alert_type": "resolved",
  "message": "example.com is UP",
  "summary": "HTTP check recovered — status 200, latency 120ms",
  "entity_id": "<monitor-uuid>"
}
```

> ⚠️ If `entity_id` is missing or mismatched on resolve, Zenduty will NOT close the
> existing incident. It will create a new, already-resolved event instead.

---

### Field Reference

| Field        | Type           | Required | Description                                                                 |
|--------------|----------------|----------|-----------------------------------------------------------------------------|
| `alert_type` | string         | YES      | `critical`, `error`, `warning`, `info`, `acknowledged`, `resolved`          |
| `message`    | string         | YES      | Becomes the incident title in Zenduty                                       |
| `summary`    | string         | YES      | Incident body/description                                                   |
| `entity_id`  | string or int  | YES*     | Deduplication key — links trigger to resolve. Use monitor UUID              |
| `payload`    | object         | No       | Arbitrary flat JSON shown as metadata in the incident                       |
| `urls`       | array          | No       | `[{ "link_url": "...", "link_text": "..." }]` — related links               |
| `suppressed` | bool           | No       | Default false. If true, creates alert but suppresses notification           |
| `urgency`    | int            | No       | `0` = low, `1` = high                                                       |

*Strongly recommended. Without it, resolves will not auto-close incidents.

---

### `alert_type` Values

| Value          | Effect                                                              |
|----------------|---------------------------------------------------------------------|
| `critical`     | Creates incident + fires all notifications (PD/call/SMS)           |
| `error`        | Creates incident (lower urgency than critical)                     |
| `warning`      | May or may not create incident depending on integration config     |
| `info`         | Usually does NOT create incident (informational only)              |
| `acknowledged` | Acknowledges the open incident matching `entity_id`                |
| `resolved`     | Closes/resolves the open incident matching `entity_id`             |

Use `critical` for down events, `resolved` for recovery events.

---

### Response

**Success (HTTP 200 or 201):**
```json
{
  "message": "success",
  "trace_id": "cadfe35f-e3b1-4175-b118-a595bff9a214"
}
```

Processing is **asynchronous** — the response only means "accepted and queued", not
"incident created". Store the `trace_id` if you need to verify creation.

**Check status (within 60 minutes):**
```
GET https://events.zenduty.com/api/alert/status/{trace_id}/
```

```json
{
  "incident": {
    "incident_number": 2524,
    "unique_id": "cNasg9C4yzNpronzUUUdKR"
  },
  "status": "completed",
  "is_incident_created": true,
  "suppressed": false
}
```

Status values: `queued`, `failed`, `completed`

**Error responses:**
- `400 Bad Request` — malformed payload
- `404 Not Found` — integration key invalid or integration disabled
- `429 Too Many Requests` — rate limit hit

---

## Rate Limits

| Operation             | Limit             |
|-----------------------|-------------------|
| Alert POST (trigger)  | 5/sec, 30/min     |
| Alerts per integration| ~100/min          |
| Events API (overall)  | ~60/min           |

On `429`: back off for at least 60 seconds before retrying.

---

## Comparison: Zenduty vs PagerDuty Events API

Both are nearly identical in design:

| Concept         | Zenduty                                   | PagerDuty                            |
|-----------------|-------------------------------------------|--------------------------------------|
| Endpoint        | `events.zenduty.com/integration/{key}/`  | `events.pagerduty.com/v2/enqueue`   |
| Auth method     | Key embedded in URL path                 | `routing_key` field in JSON body     |
| Trigger         | `alert_type: "critical"`                 | `event_action: "trigger"`           |
| Resolve         | `alert_type: "resolved"`                 | `event_action: "resolve"`           |
| Dedup key       | `entity_id`                              | `dedup_key`                         |
| Title field     | `message`                                | `payload.summary`                   |
| Extra metadata  | `payload` (flat JSON)                    | `payload.custom_details`            |
| Links           | `urls: [{link_url, link_text}]`          | `links: [{href, text}]`             |

This means adding PagerDuty later is nearly identical work.

---

## Gotchas

1. **`entity_id` is non-negotiable.** Use the monitor UUID. Without it, resolves
   silently create a new resolved event instead of closing the open incident.

2. **Events are async.** HTTP 200 ≠ incident created. If you need the incident number,
   poll the `/api/alert/status/{trace_id}/` endpoint.

3. **No auth header.** The key is the URL. Adding `Authorization` does nothing.

4. **`warning` and `info` types** may not create incidents by default, depending on how
   the user configured their Zenduty integration. Always use `critical` for down events.

5. **Rate limit = 429, retry after 60s.** Build retry with exponential backoff in the
   alert worker.
