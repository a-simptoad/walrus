# VersionFS - Decentralized Version Control System

A Git-like version control system built on **Sui blockchain** for metadata and **Walrus** for decentralized file storage.

## 🌟 Features

- **Decentralized Storage**: Files stored on Walrus (chain-agnostic blob storage)
- **Blockchain Metadata**: Version history and DAG structure on Sui
- **Git-like Operations**: commit, branch, checkout, log, diff
- **No Token Required**: Free uploads up to 10MB on Walrus testnet
- **Immutable History**: Tamper-proof commit history
- **Multi-branch Support**: Create and manage multiple branches

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         VersionFS Client                │
│  (TypeScript/Node.js Application)       │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼────────┐  ┌──────▼────────┐
│  Sui Blockchain│  │    Walrus     │
│   (Metadata)   │  │  (File Data)  │
│                │  │               │
│ - Repositories │  │ - Blob IDs    │
│ - Commits      │  │ - File Data   │
│ - Branches     │  │ - Directory   │
│ - DAG Structure│  │   Trees       │
└────────────────┘  └───────────────┘
```

## 📦 Installation

### Prerequisites

- Node.js >= 18.0.0
- Sui CLI (for deployment)
- A Sui testnet wallet with some testnet SUI

### Setup

```bash
# Clone the repository
git clone <your-repo>
cd versionfs

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your private key
nano .env
```

### Deploy Smart Contract

```bash
# Build the Move package
sui move build

# Deploy to testnet
sui client publish --gas-budget 100000000

# Note the Package ID from the output
# Update PACKAGE_ID in your code
```

## 🚀 Quick Start

### 1. Initialize a Repository

```typescript
import VersionFSClient from './versionFSClient';

const PRIVATE_KEY = "your_sui_private_key";
const PACKAGE_ID = "your_deployed_package_id";

const client = new VersionFSClient(PRIVATE_KEY, 'testnet', PACKAGE_ID);

// Initialize repository
const repoId = await client.init("my-project");
console.log(`Repository created: ${repoId}`);
```

### 2. Create Your First Commit

```typescript
// Create some files
const files = [
  {
    path: 'README.md',
    data: '# My Project\n\nDecentralized and awesome!'
  },
  {
    path: 'src/main.ts',
    data: 'console.log("Hello Walrus!");'
  }
];

// Commit to main branch
const versionId = await client.commit(
  files,
  'Initial commit',
  'main'
);

console.log(`Commit created: ${versionId}`);
```

### 3. View History

```typescript
// View last 10 commits
await client.log('main', 10);
```

### 4. Create a Branch

```typescript
// Create feature branch
await client.createBranch('feature/new-api');

// Make changes on the branch
const newFiles = [
  {
    path: 'src/api.ts',
    data: 'export class API { /* ... */ }'
  }
];

await client.commit(newFiles, 'Add API module', 'feature/new-api');
```

### 5. Checkout a Version

```typescript
// Checkout specific commit
await client.checkout(versionId, './output-dir');

// Or checkout a branch
await client.checkout('main', './main-branch');
```

## 📚 API Reference

### VersionFSClient

#### Constructor

```typescript
new VersionFSClient(
  privateKey: string,
  network: 'testnet' | 'mainnet',
  packageId?: string
)
```

#### Methods

##### `init(repoName: string): Promise<string>`
Initialize a new repository.

##### `commit(files, message, branch?): Promise<string>`
Create a new commit with files.

```typescript
await client.commit(
  [{ path: 'file.txt', data: 'content' }],
  'Commit message',
  'main'
);
```

##### `createBranch(branchName, fromVersion?): Promise<void>`
Create a new branch.

##### `checkout(target, outputDir): Promise<void>`
Checkout files from a commit or branch.

##### `log(branch, limit): Promise<CommitMetadata[]>`
View commit history.

##### `cat(filePath, version?, branch?): Promise<string>`
Get file content at specific version.

##### `diff(version1, version2): Promise<void>`
Compare two versions.

##### `status(): Promise<void>`
View repository status.

### WalrusService

#### Methods

##### `uploadFile(data, epochs?): Promise<string>`
Upload file to Walrus.

```typescript
const walrus = new WalrusService();
const blobId = await walrus.uploadFile('Hello World', 3);
```

##### `downloadFile(blobId): Promise<Uint8Array>`
Download file from Walrus.

```typescript
const data = await walrus.downloadFile(blobId);
const text = new TextDecoder().decode(data);
```

##### `uploadDirectory(directory, epochs?): Promise<string>`
Upload directory structure as JSON.

##### `downloadDirectory(blobId): Promise<DirectoryTree>`
Download and parse directory structure.

### SuiService

#### Methods

##### `createRepository(name): Promise<string>`
Create repository on Sui blockchain.

##### `commit(repoId, capId, branch, rootBlobId, parents, message): Promise<string>`
Create commit transaction.

##### `createBranch(repoId, capId, branchName, versionId): Promise<void>`
Create branch transaction.

##### `getRepository(repoId): Promise<RepositoryInfo>`
Get repository information.

##### `getBranchHead(repoId, branchName): Promise<string>`
Get current branch head.

##### `getVersion(repoId, versionId): Promise<VersionInfo>`
Get version details.

## 🛠️ CLI Usage

```bash
# Initialize repository
npm run init

# Create commit
npm run commit <repo-id> <cap-id>

# View history
npm run log <repo-id> <cap-id>

# View status
npm run status <repo-id> <cap-id>

# Run complete workflow
npm run example workflow

# Test Walrus directly
npm run test:walrus
```

## 📁 Project Structure

```
versionfs/
├── sources/
│   └── version_fs.move          # Sui Move smart contract
├── src/
│   ├── services/
│   │   ├── walrusService.ts     # Walrus storage operations
│   │   └── suiService.ts        # Sui blockchain operations
│   ├── versionFSClient.ts       # High-level client API
│   └── example.ts               # Usage examples
├── Move.toml                    # Move package config
├── package.json                 # Node.js config
├── tsconfig.json                # TypeScript config
└── README.md                    # This file
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file:

```env
# Sui Configuration
SUI_PRIVATE_KEY=suiprivkey1...
SUI_NETWORK=testnet
PACKAGE_ID=0x...

# Walrus Configuration (optional, uses defaults)
WALRUS_PUBLISHER=https://publisher.walrus-testnet.walrus.space
WALRUS_AGGREGATOR=https://aggregator.walrus-testnet.walrus.space
```

## 🌐 Walrus Storage

### Upload Limits (Testnet)

- **Free uploads**: Up to 10 MB per file
- **No WAL tokens required**: Public publishers available
- **Storage duration**: Specified in epochs (1 epoch ≈ 1 day on testnet)

### Direct Upload Example

```bash
# Upload file via curl
curl -X PUT \
  "https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=3" \
  --upload-file myfile.txt

# Download file
curl "https://aggregator.walrus-testnet.walrus.space/v1/blobs/<blob-id>"
```

### In Code

```typescript
const walrus = new WalrusService();

// Upload
const blobId = await walrus.uploadFile(fileData, 3);

// Download
const data = await walrus.downloadFile(blobId);

// Check existence
const exists = await walrus.blobExists(blobId);
```

## 📝 Smart Contract Details

### Sui Move Contract

The `version_fs.move` contract manages:

- **Repositories**: Owned objects with metadata
- **Version Nodes**: DAG structure for commits
- **Branches**: Pointers to version heads
- **Capabilities**: Access control via RepoCap

### Key Structs

```rust
struct Repository {
    id: UID,
    name: String,
    owner: address,
    branches: VecMap<String, ID>,
    versions: Table<ID, VersionNode>,
    version_count: u64,
}

struct VersionNode {
    root_blob_id: String,      // Walrus blob ID
    parents: vector<ID>,        // Parent commits
    author: address,
    timestamp: u64,
    message: String,
    version_id: ID,
}
```

### Events

- `RepositoryCreated`
- `NewCommit`
- `BranchUpdated`
- `BranchCreated`

## 🔐 Security Considerations

1. **Private Key Safety**: Never commit private keys to version control
2. **Capability Objects**: Store RepoCap safely - it proves ownership
3. **Immutable History**: Once committed, data cannot be deleted
4. **Public Testnet**: Don't store sensitive data on testnet

## 🧪 Testing

```bash
# Test Walrus upload/download
npm run test:walrus

# Test Sui interactions
npm run test:sui

# Run all examples
npm run example workflow
```

## 📊 Example Workflow

```typescript
// 1. Initialize
const client = new VersionFSClient(PRIVATE_KEY, 'testnet', PACKAGE_ID);
const repoId = await client.init("my-project");
const capId = "..."; // From transaction output

client.setRepoIds(repoId, capId);

// 2. First commit
await client.commit([
  { path: 'README.md', data: '# Hello' }
], 'Initial commit');

// 3. Create feature branch
await client.createBranch('feature/auth');

// 4. Work on feature
await client.commit([
  { path: 'auth.ts', data: 'export class Auth {}' }
], 'Add authentication', 'feature/auth');

// 5. View history
await client.log('feature/auth');

// 6. Checkout
await client.checkout('main', './main-code');
```

## 🐛 Troubleshooting

### "Not enough coins" Error

You need testnet SUI for gas fees. Get it from:
- https://faucet.sui.io

### "Package ID not found"

1. Deploy the contract first: `sui client publish`
2. Copy the Package ID from output
3. Update `PACKAGE_ID` in your code

### Walrus Upload Fails

- Check file size (< 10 MB for free tier)
- Verify network connectivity
- Try direct curl upload to test

### TypeScript Errors

```bash
# Clear and rebuild
rm -rf node_modules dist
npm install
npm run build
```

## 🚀 Deployment to Mainnet

1. Switch network: `sui client switch --env mainnet`
2. Deploy contract: `sui client publish --gas-budget 100000000`
3. Update client: `new VersionFSClient(key, 'mainnet', packageId)`
4. Use mainnet Walrus endpoints (when available)

## 📖 Additional Resources

- [Sui Documentation](https://docs.sui.io)
- [Walrus Documentation](https://docs.walrus.site)
- [Move Language Book](https://move-language.github.io/move/)
- [TypeScript Sui SDK](https://sdk.mystenlabs.com/typescript)

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 👥 Authors

Built with ❤️ for the decentralized web

## 🙏 Acknowledgments

- Mysten Labs for Sui and Walrus
- The Move language community
- All contributors

---

**Note**: This is testnet software. Use at your own risk. Do not store sensitive or critical data.