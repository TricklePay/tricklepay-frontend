# Documentation

Reference documentation for the TricklePay frontend, beyond what fits in the
[root README../README.md].

| Document | Describes |
| --- | --- |
| [accessibility.md](accessibility.md) | The accessibility commitments the project holds — skip link, focus visibility and handling, live announcements, form labelling, reduced motion and more — with the code that implements each, how to verify it, and the known gaps that are *not* commitments. |
| [api-contract.md](api-contract.md) | The frontend's contract with both backends it depends on — the read-only tricklepay-backend REST API and the on-chain Soroban stream contract: request/response shapes, amount and time encoding, the write transaction lifecycle, and the on-chain error-code mapping. |
| [api-contract-mock.md](api-contract-mock.md) | Currently byte-for-byte identical to `api-contract.md` rather than documenting the mock mode its name suggests — likely a leftover copy from that work. Listed here so this index matches what's actually in the directory; worth merging into `api-contract.md` or rewriting for the mock mode specifically. |
| [balance-interpolation.md](balance-interpolation.md) | Why balances advance locally between fetches instead of polling the API every second, how often authoritative data is fetched, and why the ledger clock remains the source of truth. |
| [create-form-draft.md](create-form-draft.md) | Why the create-stream form can already be filled in when you open it: what is stored in `localStorage`, when a draft is saved and restored, and every way to discard one. |
| [create-form-validation.md](create-form-validation.md) | Every rule the create-stream form enforces before a transaction is built, the exact message each one shows, and when it runs. |
| [local-setup.md](local-setup.md) | Start-to-finish guide to running the frontend on your own machine: prerequisites, every environment variable and where its value comes from, how to verify the setup works, and what common first-run failures mean. |
| [slow-network.md](slow-network.md) | How the client handles a slow network: backend request timeouts and cancellation, and the recovery path for an on-chain transaction that doesn't confirm in time. |
| [timeout-recovery.md](timeout-recovery.md) | What it means when a transaction's confirmation times out — why the transaction may still settle — and how to recover it with a re-check or the block explorer. |
