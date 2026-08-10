// A stand-in for the Freighter browser extension.
//
// @stellar/freighter-api does not expose an injectable `window.freighter`
// object — it posts `FREIGHTER_EXTERNAL_MSG_REQUEST` messages onto the page and
// waits for a matching `FREIGHTER_EXTERNAL_MSG_RESPONSE`, which the real
// extension's content script supplies. So the seam for a test is that message
// protocol: install a listener that answers those requests as an unlocked,
// already-authorised wallet.
//
// Signing is a pass-through. The app only re-parses the returned XDR and hands
// it to the RPC server, both of which are faked here, so a real signature would
// not be checked by anything. See e2e/README.md for what that does and does not
// prove.

export const TEST_ADDRESS = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

export interface FreighterStubOptions {
  address?: string;
  /** Freighter's own network label, e.g. "TESTNET" or "PUBLIC". */
  network?: string;
  networkPassphrase?: string;
}

// Runs in the browser before any app code. Written as a standalone function so
// it can be handed to Playwright's addInitScript.
export function installFreighterStub(options: FreighterStubOptions = {}): void {
  const address = options.address ?? "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
  const network = options.network ?? "TESTNET";
  const networkPassphrase = options.networkPassphrase ?? "Test SDF Network ; September 2015";

  // Every signed transaction, so a test can assert what the app submitted.
  const signed: string[] = [];
  (window as unknown as { __signedTransactions: string[] }).__signedTransactions = signed;

  // Every request type the app sent, in order. Lets a test count how many times
  // the wallet was probed per page load — one shared probe versus one per
  // consumer is the difference a context provider makes.
  const requests: string[] = [];
  (window as unknown as { __walletRequests: string[] }).__walletRequests = requests;

  window.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as {
      source?: string;
      type?: string;
      messageId?: number;
    } | null;
    if (event.source !== window) return;
    if (!data || data.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") return;

    if (typeof data.type === "string") requests.push(data.type);

    const payload = respond(data as { type?: string; transactionXdr?: string });
    if (!payload) return;

    window.postMessage(
      {
        source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
        // Freighter's own client matches on `messagedId` (its typo, not ours).
        // Responding with `messageId` leaves every request hanging forever.
        messagedId: data.messageId,
        ...payload,
      },
      window.location.origin,
    );
  });

  function respond(request: { type?: string; transactionXdr?: string }): object | null {
    switch (request.type) {
      case "REQUEST_CONNECTION_STATUS":
        return { isConnected: true };
      case "REQUEST_ALLOWED_STATUS":
      case "SET_ALLOWED_STATUS":
        return { isAllowed: true };
      case "REQUEST_ACCESS":
      case "REQUEST_PUBLIC_KEY":
        return { publicKey: address };
      case "REQUEST_NETWORK":
        return { network, networkPassphrase };
      case "REQUEST_NETWORK_DETAILS":
        return { network, networkPassphrase, networkUrl: "", sorobanRpcUrl: "" };
      case "SUBMIT_TRANSACTION": {
        const xdr = request.transactionXdr ?? "";
        signed.push(xdr);
        return { signedTransaction: xdr, signerAddress: address };
      }
      default:
        return null;
    }
  }
}
