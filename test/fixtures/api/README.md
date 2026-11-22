# Backend API Response Fixtures

These fixtures are recorded responses from a running instance of `tricklepay-backend`. They ensure that the client's schema validators (`parseStreamListResponse`, `parseStreamView`) and error handling are tested against actual backend payloads rather than synthetic hand-crafted objects.

## Fixtures and Production Commands

| Fixture File | Endpoint / Case | Production Command |
| --- | --- | --- |
| `list-with-total.json` | `GET /streams?limit=25&offset=0&includeTotal=true` | `curl -s "http://localhost:3000/streams?limit=25&offset=0&includeTotal=true" > test/fixtures/api/list-with-total.json` |
| `list-without-total.json` | `GET /streams?limit=25&offset=0` | `curl -s "http://localhost:3000/streams?limit=25&offset=0" > test/fixtures/api/list-without-total.json` |
| `stream-detail.json` | `GET /streams/1` | `curl -s "http://localhost:3000/streams/1" > test/fixtures/api/stream-detail.json` |
| `error-400.json` | `GET /streams?unknownParam=1` (Bad Request) | `curl -s "http://localhost:3000/streams?unknownParam=1" > test/fixtures/api/error-400.json` |
| `error-404.json` | `GET /streams/nonexistent-stream-999` (Not Found) | `curl -s "http://localhost:3000/streams/nonexistent-stream-999" > test/fixtures/api/error-404.json` |
| `error-429.json` | Rate limit exceeded | `curl -s "http://localhost:3000/streams" > test/fixtures/api/error-429.json` (see "Recording the 429 fixture" below) |

A plain `curl` to `/streams` returns `200` with a list response, so it cannot
produce the 429 fixture on its own. `error-429.json` has to be recorded against
a backend configured with a very low rate limit.

## Recording the 429 fixture

1. Start the backend with a low limit and a short window, for example:

   ```bash
   RATE_LIMIT_MAX=1 RATE_LIMIT_WINDOW_MS=60000 npm start
   ```

2. Send requests until the backend returns `429`, then record the body:

   ```bash
   curl -s -o test/fixtures/api/error-429.json -w '%{http_code}\n' \
     "http://localhost:3000/streams"
   ```

   Repeat the `curl` until it prints `429`; earlier calls return `200` and
   would overwrite the fixture with a list response.

3. Confirm the recorded file is an error body, not a list response — it should
   have an `error` field and no `streams` field:

   ```bash
   cat test/fixtures/api/error-429.json
   ```

## Updating Fixtures

To refresh these fixtures against a running local backend, execute the curl commands listed above and verify the changes with `npm test`.
