# Hedera Azure HSM — Complete Setup & Run Guide

This guide provides a comprehensive walkthrough for setting up a **secp256k1 signing key in an Azure Key Vault (Premium SKU)** and using it to sign Hedera Hashgraph transactions with a Node.js application. It incorporates solutions to common Azure CLI and SDK integration issues.

---

## Part 1: Azure Infrastructure Setup (CLI)

These steps will configure all the necessary cloud resources using the Azure CLI.

### 1. Prerequisites

| Requirement | Notes |
| :--- | :--- |
| **Azure Account** | A free trial with credits will work. |
| **Azure CLI** | [Installation Instructions](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) |
| **Node.js & npm** | Version 18.0.0 or higher. |

### 2. Login and Set Subscription

First, log in to your Azure account and set the subscription you want to use.

```bash
# Log in to your Azure account
az login

# List your available subscriptions
az account list --output table

# Set the active subscription
az account set --subscription "<YOUR_SUBSCRIPTION_ID>"
````

### 3\. Create a Resource Group

A resource group is a container for all your project's Azure resources.

```bash
az group create --name "hedera-hsm-rg" --location "eastus"
```

### 4\. Register the Key Vault Provider

Your subscription must be registered to use the Key Vault service. This step prevents the `MissingSubscriptionRegistration` error.

```bash
# Register the provider
az provider register --namespace Microsoft.KeyVault

# Check the registration status (wait for "Registered")
az provider show -n Microsoft.KeyVault --query "registrationState"
```

### 5\. Create a Premium Key Vault

To use HSM-backed keys (`EC-HSM`), you **must** use the **Premium** SKU. This prevents the `HardwareKeysNotSupported` error. The Key Vault name must be globally unique.

```bash
# Set a unique name for your Key Vault
export KEY_VAULT_NAME="hedera-hsm-vault-$RANDOM"

# Create the vault with the Premium SKU
az keyvault create --name $KEY_VAULT_NAME --resource-group "hedera-hsm-rg" --location "eastus" --sku "Premium"
```

### 6\. Create the HSM-Backed Key

Now, create the `EC-HSM` key. Before you do, you must grant your own user account permission to create keys in the vault. This prevents the `Forbidden` error during key creation.

```bash
# Grant your user account the "Key Vault Crypto Officer" role
az role assignment create --role "Key Vault Crypto Officer" --assignee <YOUR_EMAIL_LOGIN> --scope "/subscriptions/<YOUR_SUBSCRIPTION_ID>/resourceGroups/hedera-hsm-rg/providers/Microsoft.KeyVault/vaults/$KEY_VAULT_NAME"

# Wait a minute for permissions to apply, then create the HSM key
az keyvault key create --vault-name $KEY_VAULT_NAME --name "hedera-secp256k1-hsm" --kty "EC-HSM" --curve "P-256K"
```

### 7\. Create a Service Principal

Create a service principal to authenticate with Azure.

```bash
az ad sp create-for-rbac --name "HederaHSMSigner"
```

This will output a JSON object. **Save the `appId`, `password`, and `tenant` values** for your `.env` file later.

### 8\. Grant Service Principal Access

Grant the service principal the "Key Vault Crypto User" role. This role allows it to get the public key and perform sign operations. We use the `--assignee` flag with the service principal's `appId` to avoid argument errors.

```bash
# Set the appId from the previous step as a variable
export AZURE_CLIENT_ID="<APP_ID_FROM_STEP_7>"

# Assign the role
az role assignment create --role "Key Vault Crypto User" --assignee $AZURE_CLIENT_ID --scope "/subscriptions/<YOUR_SUBSCRIPTION_ID>/resourceGroups/hedera-hsm-rg/providers/Microsoft.KeyVault/vaults/$KEY_VAULT_NAME"
```

-----

## Part 2: Running the Script

Now that the Azure infrastructure is ready, you can configure and run the application.

### 1\. Install Dependencies

In your project directory, install the necessary Azure packages.

```bash
npm install 
```

### 2\. Create the `.env` File

Create a file named `.env` and populate it with your credentials.

```
# Service Principal Credentials from Step 7
AZURE_CLIENT_ID="<your-appId-from-step-7>"
AZURE_CLIENT_SECRET="<your-password-from-step-7>"
AZURE_TENANT_ID="<your-tenant-from-step-7>"

# Key Vault Details
AZURE_KEY_VAULT_URI="https://<YOUR_KEY_VAULT_NAME>.vault.azure.net"
AZURE_KEY_NAME="hedera-secp256k1-hsm"

# Hedera Account Details
HEDERA_ACCOUNT_ID="<YOUR_HEDERA_ACCOUNT_ID>"
HEDERA_PRIVATE_KEY="<YOUR_HEDERA_PRIVATE_KEY>"
```

### 3\. Run the `azure-hedera-hsm.js` Script

Finally, execute the script.

```bash
node azure-hedera-hsm.js
```

You should see a successful run, creating an account and signing a transaction using your Azure HSM key.

-----

## Part 3: Verification and Cleanup

### 1\. Verify HSM Usage

To confirm that the key is HSM-protected, run this command.

```bash
az keyvault key show --vault-name $KEY_VAULT_NAME --name "hedera-secp256k1-hsm" --query "key.kty"
```

The output must be `"EC-HSM"`.

### 2\. Cleanup

To delete all the created resources, simply delete the resource group.

```bash
az group delete --name "hedera-hsm-rg" --yes
```