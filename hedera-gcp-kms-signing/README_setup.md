# Hedera Google Cloud HSM – **Setup Guide**

This README walks you from a brand-new Google Cloud account to a **secp256k1
signing key stored in Cloud HSM**, ready for the demo script in this repo.

---

## 0  Prerequisites

| Requirement | Notes |
|-------------|-------|
| Google Cloud account | Billing enabled (free-trial credits are fine - Google gives away $300 USD currently) |
| Cloud SDK (`gcloud`) | <https://cloud.google.com/sdk/docs/install> |
| Node 18 + npm | Any LTS ≥ 18.0.0 |

---

## 1  Create / pick a project

```bash
gcloud auth login                        
gcloud projects create <PROJECT_NAME> #eg hedera-hsm-demo
gcloud config set project <PROJECT_NAME>
```

## 2 Enable Cloud KMS API
```
gcloud services enable cloudkms.googleapis.com
```

## 3 Enable Billing

Copy account id:
```
gcloud billing accounts list
```

Set environment variables:
```
PROJECT_ID=$(gcloud config get-value project)      # prints the ID you just created
BILLING_ACCOUNT_ID=<YOUR_ACCOUNT_ID>               # paste from prev step

```

Link billing account to the current project:
```
gcloud billing projects link "$PROJECT_ID" \
  --billing-account="$BILLING_ACCOUNT_ID"
```


## 4 Choose an HSM-capable region & make a key-ring
```
export LOCATION=us-east1         
export KEY_RING=hedera-ring

gcloud kms keyrings create $KEY_RING --location=$LOCATION
```

## 5 Create the HSM-backed secp256k1 key
```
export KEY_NAME=hedera-secp256k1-hsm

gcloud kms keys create $KEY_NAME \
  --location=$LOCATION --keyring=$KEY_RING \
  --purpose=asymmetric-signing \
  --default-algorithm=ec-sign-secp256k1-sha256 \
  --protection-level=hsm
```

## 6 Grab the first key-version name
```
export KEY_VERSION=$(gcloud kms keys versions list \
  --location=$LOCATION --keyring=$KEY_RING --key=$KEY_NAME \
  --format='value(name)' | head -n1)

echo "GCP_KMS_KEY_VERSION=$KEY_VERSION" >> .env     
```

## 7 Create a signer service-account
```
gcloud iam service-accounts create hedera-signer \
  --display-name "Hedera HSM Signer"
```

### 7.1 Grant minimal roles on the key
```
PROJECT_ID=$(gcloud config get-value project)

gcloud kms keys add-iam-policy-binding $KEY_NAME \
  --location=$LOCATION --keyring=$KEY_RING \
  --member="serviceAccount:hedera-signer@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudkms.signer"

gcloud kms keys add-iam-policy-binding $KEY_NAME \
  --location=$LOCATION --keyring=$KEY_RING \
  --member="serviceAccount:hedera-signer@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudkms.publicKeyViewer"
```

## 8 Download a JSON credentials file
```
gcloud iam service-accounts keys create ~/hedera-signer.json \
  --iam-account hedera-signer@$PROJECT_ID.iam.gserviceaccount.com

echo "GOOGLE_APPLICATION_CREDENTIALS=$HOME/hedera-signer.json" >> .env
```
