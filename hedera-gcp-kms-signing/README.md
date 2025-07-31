# Hedera Google Cloud HSM — **Run & Verify Guide**

You already finished the provisioning steps (key-ring, HSM key, service-account). If you haven't done this, please see README_setup.md.

This README shows how to **run the demo script** and **prove** that every Hedera
signature is generated inside Google Cloud HSM.

---

## 1  Clone & install

```bash
git clone https://github.com/nadineloepfe/hedera-gcp-kms-signing.git
npm install                
```

## 2 Create / update .env

```
GOOGLE_APPLICATION_CREDENTIALS=/home/<USER>/hedera-signer.json
GCP_KMS_KEY_VERSION=projects/<PROJECT_ID>/locations/us-east1/\
keyRings/hedera-ring/cryptoKeys/hedera-secp256k1-hsm/cryptoKeyVersions/1

HEDERA_ACCOUNT_ID=0.0.1234
HEDERA_PRIVATE_KEY=302e020100300506032b6570...
```

## 3 Run script

```
npm start           
```

Expected output:

```
🔑  New account: 0.0.567890
💰  Balance: 0.002 ℏ
📤  Transfer status: SUCCESS
            
```

## 4 Verify it really used HSM
```
gcloud kms keys versions describe 1 \
  --location=us-east1 --keyring=hedera-ring \
  --key=hedera-secp256k1-hsm \
  --format='yaml(protectionLevel, algorithm)'
```

Output MUST show:
```
protectionLevel: HSM
algorithm: EC_SIGN_SECP256K1_SHA256
```

## 5 Cleanup - Delete project
```
gcloud projects delete $PROJECT_ID --quiet
```