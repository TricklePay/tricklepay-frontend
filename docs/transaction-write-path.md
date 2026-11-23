# Transaction write path

Every on-chain write (create, withdraw, cancel) runs through `invoke()` in
`lib/contract-invoke.ts`. This diagram follows one transaction from the form
to confirmation and marks, with ❌, where each kind of failure is raised and
the message the user sees. The stage names (`preparing`, `signing`,
`submitting`, `confirming`) are the `TxStage` values shown by
`components/transaction-progress.tsx`.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Form as Form / hook<br/>(use-create-stream-form, stream actions)
    participant Invoke as invoke()<br/>lib/contract-invoke.ts
    participant Guard as Concurrency guard<br/>lib/contract-guard.ts
    participant Net as Network guard<br/>lib/contract-network.ts
    participant Tx as lib/contract-transaction.ts
    participant RPC as Soroban RPC
    participant Wallet as Freighter
    participant Confirm as confirm()<br/>lib/contract-confirm.ts

    User->>Form: Submit / confirm
    Form->>Invoke: invoke(caller, buildOp, onStageChange)
    Invoke->>Guard: acquireInvocation()
    Note over Guard: ❌ another write in flight →<br/>TX_ALREADY_IN_PROGRESS_MESSAGE
    Invoke->>Net: ensureWalletNetwork()
    Net->>Wallet: getNetwork()
    Note over Net: ❌ wallet network unreadable →<br/>WALLET_NETWORK_UNAVAILABLE_MESSAGE
    Note over Net: ❌ wallet on another network →<br/>wrongNetworkMessage(wallet, expected)

    rect rgb(240, 240, 240)
    Note over Invoke,RPC: stage: preparing
    Invoke->>Tx: buildAndPrepareTransaction()
    Tx->>RPC: getAccount(caller)
    Note over Tx: ❌ account never funded →<br/>ACCOUNT_NOT_FOUND_MESSAGE
    Tx->>RPC: prepareTransaction(tx) (simulation)
    Note over Tx: ❌ simulation reverts →<br/>parseContractError(raw):<br/>CONTRACT_ERROR_MESSAGES[N],<br/>tokenFailureMessage(N) or GENERIC_FAILURE
    end

    rect rgb(240, 240, 240)
    Note over Invoke,Wallet: stage: signing
    Invoke->>Tx: signPreparedTransaction(xdr)
    Tx->>Wallet: signTransaction(xdr)
    Wallet-->>User: Approval dialog
    Note over Tx: ❌ rejected or expired →<br/>TX_SIGNING_REJECTED_MESSAGE
    end

    rect rgb(240, 240, 240)
    Note over Invoke,RPC: stage: submitting
    Invoke->>Tx: submitSignedTransaction(signedXdr)
    Tx->>RPC: sendTransaction()
    Note over Tx: ❌ status ERROR (fee, sequence, duplicate) →<br/>TX_NETWORK_REJECTED_MESSAGE
    end

    rect rgb(240, 240, 240)
    Note over Invoke,RPC: stage: confirming
    Invoke->>Confirm: confirm(hash)
    loop until SUCCESS, FAILED or attempts exhausted
        Confirm->>RPC: getTransaction(hash)
    end
    Note over Confirm: ❌ FAILED on-chain →<br/>parseContractError(diagnostic events)
    Note over Confirm: ❌ still pending after the last poll →<br/>TransactionTimeoutError (TX_CONFIRM_TIMEOUT_MESSAGE)<br/>— may still settle, see timeout-recovery.md
    end

    Confirm-->>Invoke: hash
    Invoke->>Guard: releaseInvocation() (always, in finally)
    Invoke-->>Form: hash
    Form-->>User: Success
```

## Failure summary

| Step | Raised in | Message |
| --- | --- | --- |
| Concurrency guard | `lib/contract-invoke.ts` | `TX_ALREADY_IN_PROGRESS_MESSAGE` |
| Network guard (unreadable) | `lib/contract-network.ts` | `WALLET_NETWORK_UNAVAILABLE_MESSAGE` |
| Network guard (mismatch) | `lib/contract-network.ts` | `wrongNetworkMessage(...)` |
| Account lookup | `lib/contract-transaction.ts` | `ACCOUNT_NOT_FOUND_MESSAGE` |
| Simulation | `lib/contract-transaction.ts` | `parseContractError` → contract/token/generic message |
| Signing | `lib/contract-transaction.ts` | `TX_SIGNING_REJECTED_MESSAGE` |
| Submission | `lib/contract-transaction.ts` | `TX_NETWORK_REJECTED_MESSAGE` |
| Confirmation (failed) | `lib/contract-confirm.ts` | `parseContractError` → contract/token/generic message |
| Confirmation (timeout) | `lib/contract-confirm.ts` | `TransactionTimeoutError` / `TX_CONFIRM_TIMEOUT_MESSAGE` |

The message strings live in `lib/contract-messages.ts` and
`lib/contract-errors.ts`. How each one is shown is described in
[api-error-handling.md](api-error-handling.md); recovering a timed-out
confirmation is covered in [timeout-recovery.md](timeout-recovery.md). To add
or change a contract error message, see
[adding-contract-error-messages.md](adding-contract-error-messages.md).
