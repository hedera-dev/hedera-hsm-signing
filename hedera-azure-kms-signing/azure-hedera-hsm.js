require("dotenv").config();
const { createPublicKey } = require("crypto");
const { KeyClient, CryptographyClient } = require("@azure/keyvault-keys");
const { DefaultAzureCredential } = require("@azure/identity");
const {
  Client,
  Hbar,
  PublicKey,
  AccountCreateTransaction,
  AccountBalanceQuery,
  TransferTransaction,
} = require("@hashgraph/sdk");
const keccak256 = require("keccak256");

const {
  AZURE_KEY_VAULT_URI,
  AZURE_KEY_NAME,
  HEDERA_ACCOUNT_ID,
  HEDERA_PRIVATE_KEY,
} = process.env;

const TREASURY_ACCOUNT_ID = "0.0.3";

// --- env variables check ---
if (
  !AZURE_KEY_VAULT_URI ||
  !AZURE_KEY_NAME ||
  !HEDERA_ACCOUNT_ID ||
  !HEDERA_PRIVATE_KEY
) {
  throw new Error(
    "Missing required environment variables. Please check your .env file."
  );
}

const credential = new DefaultAzureCredential();
const keyClient = new KeyClient(AZURE_KEY_VAULT_URI, credential);
const hederaClient = Client.forTestnet().setOperator(
  HEDERA_ACCOUNT_ID,
  HEDERA_PRIVATE_KEY
);

/* ─────────────────────────
   HELPER FUNCTIONS
   ───────────────────────── */

/**
 * Asynchronously signs transaction bytes using an Azure Key Vault key.
 * @param {Uint8Array} bytesToSign - The transaction bytes to be signed.
 * @returns {Promise<Uint8Array>} The raw 64-byte ECDSA signature (r + s).
 */
async function azureSigner(bytesToSign) {
  const cryptoClient = new CryptographyClient(
    (await keyClient.getKey(AZURE_KEY_NAME)).id,
    credential
  );
  const digest = keccak256(bytesToSign);

  const signResponse = await cryptoClient.sign("ES256K", digest);

  // The signature from Azure is already in the correct format.
  return new Uint8Array(signResponse.result);
}

/**
 * Fetches the public key from Azure Key Vault and converts it to a Hedera PublicKey object.
 * @returns {Promise<PublicKey>} A Hedera PublicKey object.
 */
async function fetchAzurePublicKey() {
  console.log("Fetching public key from Azure Key Vault...");

  // Fetch the key in JSON Web Key (JWK) format from Azure
  const azureJwk = (await keyClient.getKey(AZURE_KEY_NAME)).key;

  // Change the key type from "EC-HSM" to "EC"
  azureJwk.kty = "EC";

  // Change the curve name from "P-256K" to "secp256k1"
  azureJwk.crv = "secp256k1";
  
  // Convert the x and y values from Buffers to Base64URL strings
  azureJwk.x = azureJwk.x.toString('base64url');
  azureJwk.y = azureJwk.y.toString('base64url');


  // Use Node.js's built-in crypto module to create a key object from the JWK
  const keyObject = createPublicKey({
    key: azureJwk,
    format: "jwk",
  });

  // Export the key in SPKI DER format, which is what the Hedera SDK expects
  const spkiDer = keyObject.export({ type: "spki", format: "der" });

  // Create the Hedera PublicKey from the hex representation of the DER-encoded key
  const hederaPublicKey = PublicKey.fromString(spkiDer.toString("hex"));

  console.log("✅ Successfully parsed Azure Key Vault public key.");
  return hederaPublicKey;
}

/**
 * Creates a new Hedera account funded by the operator and secured with the Azure Key Vault public key.
 * @param {PublicKey} publicKey - The public key for the new account.
 * @returns {Promise<string>} The ID of the newly created account.
 */
async function createAccountWithAzureKey(publicKey) {
  console.log(
    "Creating a new Hedera account with the Azure Key Vault public key..."
  );

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
  // 1. Fetch the public key from Azure Key Vault.
  const azurePublicKey = await fetchAzurePublicKey();

  // 2. Create a new Hedera account associated with that public key.
  const newAccountId = await createAccountWithAzureKey(azurePublicKey);

  // 3. Create a new client instance that will use the new account and the Azure signer.
  const clientForNewAccount = Client.forTestnet().setOperatorWith(
    newAccountId,
    azurePublicKey,
    azureSigner
  );

  // 4. Check the initial balance of the new account.
  const balance = await new AccountBalanceQuery()
    .setAccountId(newAccountId)
    .execute(clientForNewAccount);
  console.log(`Balance of the new account: ${balance.hbars.toString()}`);

  // 5. Execute a transfer from the new account, signed by Azure Key Vault.
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