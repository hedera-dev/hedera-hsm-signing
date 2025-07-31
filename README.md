# Hedera HSM/KMS Signing Solutions

This repository provides a collection of solutions for signing Hedera Hashgraph transactions using keys stored in various cloud-based Key Management Services (KMS) and Hardware Security Modules (HSMs). These examples demonstrate how to integrate Hedera with popular cloud providers to ensure that your private keys are never exposed in your application environment.

## Supported Services

This repository includes examples for the following services:

  * **AWS KMS**: Sign transactions using an asymmetric key stored in AWS Key Management Service.
  * **Azure Key Vault**: Utilize an HSM-backed `secp256k1` key in Azure Key Vault (Premium SKU) for signing.
  * **Google Cloud HSM**: Sign transactions with a Google Cloud HSM-backed `secp256k1` key.

  under construction:
  * **HashiCorp Vault**: Use HashiCorp Vault's transit secrets engine to sign Hedera transactions

## General Prerequisites

Before you begin, ensure you have the following:

  * A **Hedera Testnet account**. If you don't have one, you can register at the [Hedera Developer Portal](https://portal.hedera.com/register).
  * **Node.js** (version 18.0.0 or higher).
  * Cloud-specific CLI tools and accounts as detailed in the provider-specific sections.

## How it Works

The general workflow for each solution is as follows:

1.  **Key Generation**: An asymmetric key is created and stored in the respective KMS/HSM service.
2.  **Public Key Retrieval**: The public key corresponding to the stored private key is fetched from the KMS.
3.  **Hedera Account Creation**: A new Hedera account is created and associated with the retrieved public key.
4.  **Transaction Signing**: A custom signer function is implemented that sends transaction bytes to the KMS/HSM for signing. The Hedera SDK is configured to use this custom signer.
5.  **Transaction Execution**: Transactions are executed on the Hedera network using the client configured with the custom signer.

## Provider-Specific Solutions

### AWS KMS

This solution demonstrates how to use an `ECC_SECG_P256K1` key in AWS KMS to sign Hedera transactions.

  * **Directory**: `hedera-aws-kms-signing/`
  * **Setup**: For detailed instructions, see the [AWS KMS README](https://www.google.com/search?q=hedera-dev/hedera-hsm-signing/hedera-hsm-signing-ac36fb24037a2d3208687c1ad505977b557a1d56/hedera-aws-kms-signing/README.md).
  * **Configuration**: You will need to set up environment variables in a `.env` file with your AWS credentials, KMS key ID, and Hedera account details.

### Azure Key Vault

This solution walks through setting up a `secp256k1` signing key in an Azure Key Vault (Premium SKU) and using it to sign Hedera transactions.

  * **Directory**: `hedera-azure-kms-signing/`
  * **Setup**: For a comprehensive guide, refer to the [Azure Key Vault README](https://www.google.com/search?q=hedera-dev/hedera-hsm-signing/hedera-hsm-signing-ac36fb24037a2d3208687c1ad505977b557a1d56/hedera-azure-kms-signing/README.md).
  * **Configuration**: Create a `.env` file with your Azure service principal credentials, Key Vault details, and Hedera account information.

### Google Cloud HSM

This example shows how to use a Google Cloud HSM-backed `secp256k1` key for signing Hedera transactions.

  * **Directory**: `hedera-gcp-kms-signing/`
  * **Setup**: Follow the setup instructions in the [Google Cloud HSM Setup Guide](https://www.google.com/search?q=hedera-dev/hedera-hsm-signing/hedera-hsm-signing-ac36fb24037a2d3208687c1ad505977b557a1d56/hedera-gcp-kms-signing/README_setup.md) and the [Run & Verify Guide](https://www.google.com/search?q=hedera-dev/hedera-hsm-signing/hedera-hsm-signing-ac36fb24037a2d3208687c1ad505977b557a1d56/hedera-gcp-kms-signing/README.md).
  * **Configuration**: An `.env` file is required with your Google Cloud credentials, KMS key version, and Hedera account details.

### HashiCorp Vault

This solution tries to utilise HashiCorp Vault's transit secrets engine to manage keys and sign Hedera transactions. 

  * **Directory**: `hedera-hashicorp-vault-signing/`
  * **Setup**: See the `vault-hedera.js` file for implementation details and the `.env.sample` for required configuration.
  * **Configuration**: You'll need to configure a `.env` file with your Vault address, token, and Hedera account credentials. A policy file (`hedera-policy.hcl`) is also provided to demonstrate the necessary permissions.

This is currenlty not working due to an incompatible Vault environment. The specific build of Vault being used is non-standard and lacks support for the **`secp256k1`** cryptographic curve, making it unsuitable for this project's requirements. Tbc.

## Disclaimer

These examples are for demonstration purposes only. When implementing in a production environment, always follow security best practices for key management and access control.