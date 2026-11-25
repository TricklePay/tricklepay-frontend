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
| `error-429.json` | Rate limit exceeded | See [Recording error-429.json](#recording-error-429json) |

## Updating Fixtures

To refresh these fixtures against a running local backend, execute the curl commands listed above and verify the changes with `npm test`.

## Recording error-429.json

A single request returns 200, so the plain `curl` used for the other fixtures would overwrite this file with a list response. To get a 429:

1. Start `tricklepay-backend` with a low limit, for example `RATE_LIMIT_MAX=1`.
2. Send several requests and keep only the body of the one that returns 429:

```sh
for i in 1 2 3 4 5; do
  code=$(curl -s -o /tmp/error-429.json -w "%{http_code}" "http://localhost:3000/streams")
  if [ "$code" = "429" ]; then
    cp /tmp/error-429.json test/fixtures/api/error-429.json
    break
  fi
done
```

If no request returns 429, the file is left unchanged. Restart the backend without the low limit afterwards, then run `npm test` to check that the fixture expectations still hold.
