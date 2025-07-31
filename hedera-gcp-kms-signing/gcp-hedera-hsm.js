require("dotenv").config();
const { createPublicKey } = require("crypto");
const { KeyManagementServiceClient } = require("@google-cloud/kms");
const {
  Client,
  Hbar,
  PublicKey,
  AccountCreateTransaction,
  AccountBalanceQuery,
  TransferTransaction,
} = require("@hashgraph/sdk");
const keccak256 = require("keccak256");
const asn1 = require("asn1.js");

const {
  GCP_KMS_KEY_VERSION,
  HEDERA_ACCOUNT_ID,
  HEDERA_PRIVATE_KEY,
  
} = process.env;

const TREASURY_ACCOUNT_ID = "0.0.3";

// --- env variables check ---
if (!GCP_KMS_KEY_VERSION || !HEDERA_ACCOUNT_ID || !HEDERA_PRIVATE_KEY) {
  throw new Error(
    "Missing required environment variables. Please check your .env file."
  );
}

const kmsClient = new KeyManagementServiceClient();
const hederaClient = Client.forTestnet().setOperator(
  HEDERA_ACCOUNT_ID,
  HEDERA_PRIVATE_KEY
);

/* ─────────────────────────
   HELPER FUNCTIONS
   ───────────────────────── */
const EcdsaSig = asn1.define("EcdsaSig", function () {
  this.seq().obj(this.key("r").int(), this.key("s").int());
});

/**
 * Asynchronously signs transaction bytes using a Google KMS key.
 * This function will be called automatically by the Hedera SDK when a transaction needs a signature.
 * @param {Uint8Array} bytesToSign - The transaction bytes to be signed.
 * @returns {Promise<Uint8Array>} The raw 64-byte ECDSA signature (r + s).
 */
async function kmsSigner(bytesToSign) {
  const digest = keccak256(bytesToSign);

  const [signResponse] = await kmsClient.asymmetricSign({
    name: GCP_KMS_KEY_VERSION,
    digest: { sha256: digest },
  });
  // KMS returns a DER-encoded ASN.1 signature. We must convert it to a raw (r || s) format.
  const { r, s } = EcdsaSig.decode(signResponse.signature, "der");
  const signature = new Uint8Array(64);
  signature.set(r.toArray("be", 32), 0);
  signature.set(s.toArray("be", 32), 32);

  return signature;
}

/**
 * Fetches the public key from Google KMS and converts it to a Hedera PublicKey object.
 * @returns {Promise<PublicKey>} A Hedera PublicKey object.
 */
async function fetchKmsPublicKey() {
  console.log("Fetching public key from Google KMS...");

  const [kmsPublicKey] = await kmsClient.getPublicKey({
    name: GCP_KMS_KEY_VERSION,
  });

  const keyObject = createPublicKey(kmsPublicKey.pem);
  const spkiDer = keyObject.export({ type: "spki", format: "der" });

  const publicKey = PublicKey.fromString(spkiDer.toString("hex"));

  console.log("✅ Successfully parsed KMS public key.");
  return publicKey;
}

/**
 * Creates a new Hedera account funded by the operator and secured with the KMS public key.
 * @param {PublicKey} publicKey - The public key for the new account.
 * @returns {Promise<string>} The ID of the newly created account.
 */
async function createAccountWithKmsKey(publicKey) {
  console.log("Creating a new Hedera account with the KMS public key...");

  const transaction = new AccountCreateTransaction()
    .setKey(publicKey)
    .setInitialBalance(new Hbar(1)); // 1 Hbar

  const txResponse = await transaction.execute(hederaClient);
  const receipt = await txResponse.getReceipt(hederaClient);

  if (!receipt.accountId) {
    throw new Error("Account creation failed.");
  }

  console.log(
    `✅ Successfully created account: ${receipt.accountId.toString()}`
  );
  return receipt.accountId;
}

/* ─────────────────────────
   MAIN EXECUTION
   ───────────────────────── */

async function main() {
  // 1. Fetch the public key from KMS.
  const kmsPublicKey = await fetchKmsPublicKey();

  // 2. Create a new Hedera account associated with that public key.
  const newAccountId = await createAccountWithKmsKey(kmsPublicKey);

  // 3. Create a new client instance that will use the new account and the KMS signer.
  const clientForNewAccount = Client.forTestnet().setOperatorWith(
    newAccountId,
    kmsPublicKey,
    kmsSigner
  );

  // 4. Check the initial balance of the new account.
  const balance = await new AccountBalanceQuery()
    .setAccountId(newAccountId)
    .execute(clientForNewAccount);
  console.log(
    `Balance of the new account: ${balance.hbars.toString()}`
  );

  // 5. Execute a transfer from the new account, signed by KMS.
  console.log("Executing a transfer from the new account...");
  const transferTransaction = new TransferTransaction()
    .addHbarTransfer(newAccountId, Hbar.fromTinybars(-10_000))
    .addHbarTransfer(TREASURY_ACCOUNT_ID, Hbar.fromTinybars(10_000))
    .freezeWith(clientForNewAccount);

  const txResponse = await transferTransaction.execute(clientForNewAccount);
  const receipt = await txResponse.getReceipt(clientForNewAccount);

  console.log(`✅ Transfer status: ${receipt.status.toString()}`);

  // 6. Check the final balance.
  const finalBalance = await new AccountBalanceQuery()
    .setAccountId(newAccountId)
    .execute(clientForNewAccount);
  console.log(`Final account balance: ${finalBalance.hbars.toString()}`);
}

main().catch((error) => {
  console.error("An error occurred:", error);
  process.exit(1);
});