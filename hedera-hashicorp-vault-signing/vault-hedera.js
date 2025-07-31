require("dotenv").config();
const axios = require("axios").create({
  baseURL: process.env.VAULT_ADDR,
  headers: { "X-Vault-Token": process.env.VAULT_TOKEN },
});
const {
  Client,
  Hbar,
  PublicKey,
  AccountCreateTransaction,
  AccountBalanceQuery,
  TransferTransaction,
} = require("@hashgraph/sdk");

/* ---------- fetch Vault public key from TRANSIT engine----------- */
async function getVaultPublicKey() {
  const { data } = await axios.get("/v1/transit/keys/hedera-key");
  const pubKeyBase64 = data.data.keys["1"].public_key;
  // This is the key change: using the correct function for an ed25519 key
  return PublicKey.fromString(pubKeyBase64);
}

/* ---------- Hedera signer callback for TRANSIT engine----------- */
async function vaultSigner(bytesToSign) {
  const inputData = Buffer.from(bytesToSign).toString("base64");
  const { data } = await axios.post("/v1/transit/sign/hedera-key", {
    input: inputData,
  });
  // The signature format from ed25519 is just the raw signature, not DER encoded
  const signature = data.data.signature.split(":")[2];
  return Buffer.from(signature, "base64");
}

/* ---------- main flow ------------------------ */
(async () => {
  try {
    const payerId = process.env.HEDERA_ACCOUNT_ID;
    const payerKey = process.env.HEDERA_PRIVATE_KEY;
    const pubKey = await getVaultPublicKey();
    const admin = Client.forTestnet().setOperator(payerId, payerKey);

    console.log("Creating new account with public key from Vault...");
    const tx = await new AccountCreateTransaction()
      .setKey(pubKey)
      .setInitialBalance(Hbar.fromTinybars(200_000))
      .execute(admin);

    const receipt = await tx.getReceipt(admin);
    const newId = receipt.accountId;
    console.log("🔑  New account:", newId.toString());

    const client = Client.forTestnet().setOperatorWith(newId, pubKey, vaultSigner);
    const bal = await new AccountBalanceQuery().setAccountId(newId).execute(client);
    console.log("💰  Balance:", bal.hbars.toString());

    console.log("Attempting to sign a transfer transaction with Vault...");
    const transferReceipt = await new TransferTransaction()
      .addHbarTransfer(newId, Hbar.fromTinybars(-10_000))
      .addHbarTransfer("0.0.3", Hbar.fromTinybars(10_000))
      .execute(client)
      .then((t) => t.getReceipt(client));
    console.log("✅  Transfer status:", transferReceipt.status.toString());
  } catch (error) {
    if (error.response) {
      console.error(
        "❌ Error from Vault:",
        JSON.stringify(error.response.data, null, 2)
      );
    } else {
      console.error("An unexpected error occurred:", error);
    }
    process.exit(1);
  }
})();