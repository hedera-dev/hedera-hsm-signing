# Allow reading the public key from the transit key
path "transit/keys/hedera-key" {
  capabilities = ["read"]
}

# Allow signing with the transit key
path "transit/sign/hedera-key" {
  capabilities = ["update"]
}
