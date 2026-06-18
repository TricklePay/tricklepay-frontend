import {
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import { config } from "@/lib/config";

export interface CreateStreamParams {
  sender: string;
  recipient: string;
  token: string;
  totalAmount: bigint;
  startTime: bigint;
  endTime: bigint;
  cliffTime: bigint;
}

function server(): rpc.Server {
  return new rpc.Server(config.rpcUrl, { allowHttp: config.rpcUrl.startsWith("http://") });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Builds, signs (via Freighter), submits, and confirms a contract invocation,
// returning the transaction hash once it succeeds on-chain. Each step surfaces
// a distinct error so the UI can tell the user what went wrong.
async function invoke(
  caller: string,
  buildOp: (contract: Contract) => xdr.Operation,
): Promise<string> {
  const srv = server();
  const contract = new Contract(config.contractId);
  const account = await srv.getAccount(caller);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(buildOp(contract))
    .setTimeout(60)
    .build();

  // Simulate and assemble the Soroban resource footprint before signing.
  const prepared = await srv.prepareTransaction(tx);

  const signed = await signTransaction(prepared.toXDR(), {
    networkPassphrase: config.networkPassphrase,
    address: caller,
  });
  if (signed.error) {
    throw new Error("Signing was rejected in the wallet.");
  }

  const signedTx = TransactionBuilder.fromXDR(signed.signedTxXdr, config.networkPassphrase);
  const sent = await srv.sendTransaction(signedTx);
  if (sent.status === "ERROR") {
    throw new Error("The network rejected the transaction.");
  }

  return confirm(srv, sent.hash);
}

async function confirm(srv: rpc.Server, hash: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const result = await srv.getTransaction(hash);
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return hash;
    }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error("The transaction failed on-chain.");
    }
    await sleep(1000);
  }
  throw new Error("Timed out waiting for confirmation.");
}

export async function createStream(params: CreateStreamParams): Promise<string> {
  return invoke(params.sender, (contract) =>
    contract.call(
      "create_stream",
      new Address(params.sender).toScVal(),
      new Address(params.recipient).toScVal(),
      new Address(params.token).toScVal(),
      nativeToScVal(params.totalAmount, { type: "i128" }),
      nativeToScVal(params.startTime, { type: "u64" }),
      nativeToScVal(params.endTime, { type: "u64" }),
      nativeToScVal(params.cliffTime, { type: "u64" }),
    ),
  );
}

export async function withdraw(caller: string, streamId: bigint): Promise<string> {
  return invoke(caller, (contract) =>
    contract.call("withdraw", nativeToScVal(streamId, { type: "u64" })),
  );
}

export async function cancel(caller: string, streamId: bigint): Promise<string> {
  return invoke(caller, (contract) =>
    contract.call("cancel", nativeToScVal(streamId, { type: "u64" })),
  );
}
