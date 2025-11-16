# BTC University Smart Contracts

Smart contracts for BTC University - a Bitcoin-powered learning platform using sBTC on Stacks.

## Contracts

- `btc-university.clar` - Main contract with course management, enrollment, and sBTC payments
- `btc-university-nft.clar` - NFT certificates for course completion
- `sip010-trait.clar` - SIP-010 fungible token trait for sBTC integration
- `mock-sbtc-token.clar` - Mock sBTC for testing only (DO NOT deploy to production)

## Testing

Run tests: `npm install && npm test`

All 95 unit tests validate contract functionality with mock sBTC.

## Deployment

### Testnet Deployment

Deploy contracts: `clarinet deployments generate --testnet && clarinet deployments apply --testnet`

After deployment, initialize sBTC contract address: `set-sbtc-contract ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token`

### Mainnet Deployment

Deploy contracts: `clarinet deployments generate --mainnet && clarinet deployments apply --mainnet`

After deployment, initialize sBTC contract address: `set-sbtc-contract SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`

## Official sBTC Addresses

- Testnet: `ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token`
- Mainnet: `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`


## Security Features

Built with owner-controlled sBTC integration. The contract validates all sBTC operations against the owner-configured address. Clients cannot pass arbitrary sBTC contracts.

Input validation checks enforce data integrity for all principal addresses, amounts, and string lengths. Course prices and student limits can be zero for free or unlimited courses.

The mock sBTC contract is for testing only.

## Key Technical Details

Contracts use SIP-010 trait-based dependency injection for sBTC integration. This enables testing with mock tokens while supporting real sBTC in production.

The enrollment system requires users to be whitelisted before enrolling in courses. Whitelist access can be granted by the owner or self-enrolled with sufficient sBTC balance.

Course fees accumulate in contract escrow and can be claimed by instructors. NFT certificates are minted upon course completion.

## Resources

- [Stacks Documentation](https://docs.stacks.co/)
- [sBTC Integration Guide](https://www.hiro.so/blog/how-to-integrate-sbtc-into-your-application)
- [Clarinet Documentation](https://docs.hiro.so/stacks/clarinet-js-sdk)
- [SECURITY.md](SECURITY.md) - Detailed security documentation
