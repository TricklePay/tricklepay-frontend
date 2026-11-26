# Vesting test vectors

`test/fixtures/vesting-vectors.json` is a copy of the backend's vesting vectors.
Both repositories check their mirror of the contract's vesting math against the
same cases, so the two cannot drift from each other unnoticed.

- Source: `tests/fixtures/vesting-vectors.json` in
  [TricklePay/tricklepay-backend](https://github.com/TricklePay/tricklepay-backend)
- Source commit: `c5387dbcbf9916cb297b98a0fd4c03d7ac8cf314`
- Checked by: `lib/vesting-vectors.test.ts`, which asserts `vestedAmount` and
  `withdrawableAmount` from `lib/vesting.ts` against every vector

Each vector has the stream (`totalAmount`, `startTime`, `endTime`, `cliffTime`),
the time to evaluate at (`now`) and the expected `vested` amount. All values are
decimal strings so they survive JSON as bigints.

## Updating the fixture

1. Find the latest commit that touched the file in the backend repository.
2. Copy the file over `test/fixtures/vesting-vectors.json` without editing it,
   for example:

   ```bash
   gh api "repos/TricklePay/tricklepay-backend/contents/tests/fixtures/vesting-vectors.json?ref=<commit>" \
     --jq .content | base64 -d > test/fixtures/vesting-vectors.json
   ```

3. Update the source commit above.
4. Run `npm test`. A failure means `lib/vesting.ts` no longer matches the
   backend (or the contract) and needs fixing, not the fixture.

Never change the vectors here by hand. A new case belongs in the backend file
first, then gets copied over.
