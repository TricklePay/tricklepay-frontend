# Documentation

Reference documentation for the TricklePay frontend, beyond what fits in the
[root README](../README.md).

| Document | Describes |
| --- | --- |
| [api-contract.md](api-contract.md) | The frontend's contract with both backends it depends on — the read-only tricklepay-backend REST API and the on-chain Soroban stream contract: request/response shapes, amount and time encoding, the write transaction lifecycle, and the on-chain error-code mapping. |
| [api-contract-mock.md](api-contract-mock.md) | Currently byte-for-byte identical to `api-contract.md` rather than documenting the mock mode its name suggests — likely a leftover copy from that work. Listed here so this index matches what's actually in the directory; worth merging into `api-contract.md` or rewriting for the mock mode specifically. |
| [local-setup.md](local-setup.md) | Start-to-finish guide to running the frontend on your own machine: prerequisites, every environment variable and where its value comes from, how to verify the setup works, and what common first-run failures mean. |
| [slow-network.md](slow-network.md) | How the client handles a slow network: backend request timeouts and cancellation, and the recovery path for an on-chain transaction that doesn't confirm in time. |
