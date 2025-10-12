/**
 * VersionFS Complete Interactive Demo
 * Shows real uploads to Walrus with verifiable links
 * Run with: node fullDemo.js
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
  PRIVATE_KEY: "suiprivkey1qraghhjntc5dx59wuwqrj48tq35lnrlre0nr966gerucrmycexanvh9j845",
  PACKAGE_ID: "0xc2ff2e9e5f4c19782136b477b1a86bd0f3880cfa1562b49a91bd92da9f1862fc", // UPDATE THIS WITH YOUR DEPLOYED PACKAGE
  WALRUS_PUBLISHER: "https://publisher.walrus-testnet.walrus.space",
  WALRUS_AGGREGATOR: "https://aggregator.walrus-testnet.walrus.space",
};

// State tracking
const demoState = {
  repoId: null,
  capId: null,
  commits: [],
  files: [],
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function printHeader(title) {
  console.log('\n' + '═'.repeat(80));
  console.log(`  ${title}`);
  console.log('═'.repeat(80) + '\n');
}

function printStep(step, title) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`[STEP ${step}] ${title}`);
  console.log('─'.repeat(80));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getWalrusViewLink(blobId) {
  return `${CONFIG.WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
}

// ============================================================
// WALRUS FUNCTIONS
// ============================================================

async function uploadToWalrus(data, filename = 'file') {
  try {
    const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const blob = new Blob([content]);
    
    console.log(`   📤 Uploading: ${filename} (${blob.size} bytes)`);
    
    const response = await fetch(
      `${CONFIG.WALRUS_PUBLISHER}/v1/blobs?epochs=3`,
      {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "application/octet-stream" },
      }
    );

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    const result = await response.json();
    const blobId = result.newlyCreated 
      ? result.newlyCreated.blobObject.blobId 
      : result.alreadyCertified.blobId;

    console.log(`   ✅ Uploaded! Blob ID: ${blobId}`);
    console.log(`   🔗 View at: ${getWalrusViewLink(blobId)}`);
    
    return {
      blobId,
      size: blob.size,
      viewLink: getWalrusViewLink(blobId),
      cost: result.newlyCreated?.cost || 0
    };
  } catch (error) {
    console.error(`   ❌ Upload failed:`, error.message);
    throw error;
  }
}

async function downloadFromWalrus(blobId) {
  const response = await fetch(`${CONFIG.WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  
  const arrayBuffer = await response.arrayBuffer();
  return new TextDecoder().decode(new Uint8Array(arrayBuffer));
}

// ============================================================
// SUI BLOCKCHAIN FUNCTIONS
// ============================================================

let suiClient;
let keypair;

function initializeSui() {
  suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
  const { secretKey } = decodeSuiPrivateKey(CONFIG.PRIVATE_KEY);
  keypair = Ed25519Keypair.fromSecretKey(secretKey);
  console.log(`   👤 Address: ${keypair.toSuiAddress()}`);
}

async function createRepositoryOnChain(name) {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${CONFIG.PACKAGE_ID}::version_fs::create_repository`,
    arguments: [tx.pure.string(name)],
  });

  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: {
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
    },
  });

  // Extract IDs
  const changes = result.objectChanges || [];
  let repoId = null;
  let capId = null;

  for (const change of changes) {
    if (change.type === 'created') {
      if (change.objectType.includes('Repository')) {
        repoId = change.objectId;
      } else if (change.objectType.includes('RepoCap')) {
        capId = change.objectId;
      }
    }
  }

  return { repoId, capId, digest: result.digest };
}

async function createCommitOnChain(repoId, capId, branchName, treeBlobId, parentIds, message) {
  const tx = new Transaction();

  tx.moveCall({
    target: `${CONFIG.PACKAGE_ID}::version_fs::commit`,
    arguments: [
      tx.object(repoId),
      tx.object(capId),
      tx.pure.string(branchName),
      tx.pure.string(treeBlobId),
      tx.pure.vector('id', parentIds),
      tx.pure.string(message),
    ],
  });

  const result = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  // Extract version ID from events
  const events = result.events || [];
  let versionId = null;
  for (const event of events) {
    if (event.type.includes('NewCommit')) {
      versionId = event.parsedJson.version_id;
      break;
    }
  }

  return { versionId, digest: result.digest };
}

// ============================================================
// DEMO STEPS
// ============================================================

async function step1_Initialize() {
  printStep(1, '🚀 Initialize Repository');
  
  initializeSui();
  
  console.log('\n   Creating repository on Sui blockchain...');
  const { repoId, capId, digest } = await createRepositoryOnChain("demo-dapp-project");
  
  demoState.repoId = repoId;
  demoState.capId = capId;
  
  console.log(`\n   ✅ Repository Created!`);
  console.log(`   📦 Repo ID: ${repoId}`);
  console.log(`   🔑 Cap ID:  ${capId}`);
  console.log(`   🔗 Tx: https://suiscan.xyz/testnet/tx/${digest}`);
  
  // Create initial empty commit
  const emptyTree = {};
  const treeResult = await uploadToWalrus(emptyTree, 'initial-tree.json');
  
  console.log('\n   Creating initial commit...');
  const { versionId, digest: commitDigest } = await createCommitOnChain(
    repoId,
    capId,
    'main',
    treeResult.blobId,
    [],
    'Initial commit'
  );
  
  demoState.commits.push({
    id: versionId,
    treeBlobId: treeResult.blobId,
    message: 'Initial commit',
    parents: [],
    files: [],
  });
  
  console.log(`\n   ✅ Initial Commit Created!`);
  console.log(`   📝 Version ID: ${versionId}`);
  console.log(`   🔗 Tx: https://suiscan.xyz/testnet/tx/${commitDigest}`);
  
  await sleep(2000);
}

async function step2_UploadFiles() {
  printStep(2, '📁 Upload Project Files to Walrus');
  
  console.log('\n   Creating project files...\n');
  
  const files = [
    {
      name: 'README.md',
      path: 'README.md',
      content: `# Decentralized DApp Project

Built on Sui blockchain with Walrus storage!

## Features
- Decentralized version control
- Immutable history on blockchain
- File storage on Walrus
- Git-like workflows

## Tech Stack
- Sui Move smart contracts
- Walrus blob storage
- TypeScript SDK`
    },
    {
      name: 'package.json',
      path: 'package.json',
      content: JSON.stringify({
        name: 'demo-dapp',
        version: '1.0.0',
        description: 'Decentralized application demo',
        main: 'index.js',
        scripts: {
          start: 'node index.js',
          test: 'jest'
        },
        dependencies: {
          '@mysten/sui': '^1.0.0'
        }
      }, null, 2)
    },
    {
      name: 'index.js',
      path: 'src/index.js',
      content: `// Main application entry point
console.log("Welcome to Decentralized DApp!");

async function main() {
  console.log("Connecting to Sui...");
  console.log("Loading data from Walrus...");
  console.log("App initialized!");
}

main();`
    },
    {
      name: 'config.js',
      path: 'src/config.js',
      content: `module.exports = {
  network: 'testnet',
  walrusAggregator: 'https://aggregator.walrus-testnet.walrus.space',
  suiRpcUrl: 'https://fullnode.testnet.sui.io'
};`
    }
  ];

  const uploadedFiles = [];
  let totalCost = 0;

  for (const file of files) {
    const result = await uploadToWalrus(file.content, file.name);
    uploadedFiles.push({
      name: file.name,
      path: file.path,
      blobId: result.blobId,
      size: result.size,
      viewLink: result.viewLink,
    });
    totalCost += result.cost;
    demoState.files.push(uploadedFiles[uploadedFiles.length - 1]);
    await sleep(500);
  }

  console.log(`\n   ✅ All files uploaded!`);
  console.log(`   💰 Total cost: ${totalCost} MIST (~${(totalCost / 1e9).toFixed(4)} SUI)`);
  console.log(`   📊 Files: ${uploadedFiles.length}, Total size: ${uploadedFiles.reduce((sum, f) => sum + f.size, 0)} bytes`);
  
  return uploadedFiles;
}

async function step3_CreateCommit(uploadedFiles) {
  printStep(3, '📝 Create Commit with Files');
  
  console.log('\n   Building directory tree...');
  
  // Create tree structure
  const tree = {};
  for (const file of uploadedFiles) {
    tree[file.path] = {
      blobId: file.blobId,
      size: file.size,
      type: 'file',
    };
  }
  
  // Upload tree
  const treeResult = await uploadToWalrus(tree, 'tree-v1.json');
  
  console.log('\n   Creating commit on blockchain...');
  const parentCommit = demoState.commits[demoState.commits.length - 1];
  const { versionId, digest } = await createCommitOnChain(
    demoState.repoId,
    demoState.capId,
    'main',
    treeResult.blobId,
    [parentCommit.id],
    'Add project files and configuration'
  );
  
  demoState.commits.push({
    id: versionId,
    treeBlobId: treeResult.blobId,
    message: 'Add project files and configuration',
    parents: [parentCommit.id],
    files: uploadedFiles,
  });
  
  console.log(`\n   ✅ Commit Created!`);
  console.log(`   📝 Version ID: ${versionId}`);
  console.log(`   💬 Message: "Add project files and configuration"`);
  console.log(`   📊 Files: ${uploadedFiles.length} files`);
  console.log(`   👪 Parent: ${parentCommit.id}`);
  console.log(`   🔗 Tx: https://suiscan.xyz/testnet/tx/${digest}`);
  console.log(`   🔗 Tree: ${treeResult.viewLink}`);
  
  await sleep(2000);
}

async function step4_ViewFile() {
  printStep(4, '👀 Retrieve and View File from Walrus');
  
  const readmeFile = demoState.files.find(f => f.name === 'README.md');
  
  console.log(`\n   📥 Downloading: ${readmeFile.name}`);
  console.log(`   🔗 Blob ID: ${readmeFile.blobId}`);
  console.log(`   🔗 Direct link: ${readmeFile.viewLink}`);
  
  const content = await downloadFromWalrus(readmeFile.blobId);
  
  console.log(`\n   ✅ File Retrieved!`);
  console.log(`\n   📄 Content:\n`);
  console.log('   ' + content.split('\n').join('\n   '));
  
  await sleep(2000);
}

async function step5_MakeChanges() {
  printStep(5, '✏️  Make Changes and Create New Commit');
  
  console.log('\n   Updating existing files and adding new features...\n');
  
  const updatedFiles = [
    {
      name: 'README.md',
      path: 'README.md',
      content: `# Decentralized DApp Project

Built on Sui blockchain with Walrus storage!

## Features
- ✅ Decentralized version control
- ✅ Immutable history on blockchain
- ✅ File storage on Walrus
- ✅ Git-like workflows
- 🆕 Authentication system
- 🆕 API endpoints

## Recent Updates
- Added authentication module
- Implemented REST API
- Added middleware support`
    },
    {
      name: 'auth.js',
      path: 'src/auth.js',
      content: `// Authentication module
class AuthService {
  async login(credentials) {
    console.log("Authenticating user...");
    // Verify credentials
    return { token: "jwt_token_here", user: credentials.username };
  }

  async logout() {
    console.log("User logged out");
  }

  validateToken(token) {
    // Token validation logic
    return token.startsWith('jwt_');
  }
}

module.exports = AuthService;`
    },
    {
      name: 'api.js',
      path: 'src/api.js',
      content: `// REST API endpoints
const express = require('express');
const router = express.Router();

router.get('/data', async (req, res) => {
  // Fetch from Walrus
  res.json({ message: 'Data from Walrus' });
});

router.post('/upload', async (req, res) => {
  // Upload to Walrus
  res.json({ success: true });
});

module.exports = router;`
    }
  ];

  const uploadedFiles = [];
  for (const file of updatedFiles) {
    const result = await uploadToWalrus(file.content, file.name);
    uploadedFiles.push({
      name: file.name,
      path: file.path,
      blobId: result.blobId,
      size: result.size,
      viewLink: result.viewLink,
    });
    await sleep(500);
  }

  // Create new tree
  const tree = {};
  for (const file of uploadedFiles) {
    tree[file.path] = {
      blobId: file.blobId,
      size: file.size,
      type: 'file',
    };
  }
  
  const treeResult = await uploadToWalrus(tree, 'tree-v2.json');
  
  // Create commit
  const parentCommit = demoState.commits[demoState.commits.length - 1];
  const { versionId, digest } = await createCommitOnChain(
    demoState.repoId,
    demoState.capId,
    'main',
    treeResult.blobId,
    [parentCommit.id],
    'Add authentication and API modules'
  );
  
  demoState.commits.push({
    id: versionId,
    treeBlobId: treeResult.blobId,
    message: 'Add authentication and API modules',
    parents: [parentCommit.id],
    files: uploadedFiles,
  });
  
  console.log(`\n   ✅ New Commit Created!`);
  console.log(`   📝 Version ID: ${versionId}`);
  console.log(`   📊 Changes: 1 modified, 2 added`);
  console.log(`   🔗 Tx: https://suiscan.xyz/testnet/tx/${digest}`);
  
  await sleep(2000);
}

async function step6_ViewHistory() {
  printStep(6, '📜 View Complete Commit History');
  
  console.log(`\n   Repository: ${demoState.repoId}`);
  console.log(`   Total commits: ${demoState.commits.length}\n`);
  
  console.log('   Commit History (newest first):\n');
  
  for (let i = demoState.commits.length - 1; i >= 0; i--) {
    const commit = demoState.commits[i];
    const isHead = i === demoState.commits.length - 1;
    
    console.log(`   ${isHead ? '→' : ' '} Commit: ${commit.id.slice(0, 16)}... ${isHead ? '(HEAD)' : ''}`);
    console.log(`     Message: ${commit.message}`);
    console.log(`     Files: ${commit.files?.length || 0} files`);
    console.log(`     Tree: ${commit.treeBlobId}`);
    console.log(`     🔗 Tree data: ${getWalrusViewLink(commit.treeBlobId)}`);
    if (commit.parents.length > 0) {
      console.log(`     Parent: ${commit.parents[0].slice(0, 16)}...`);
    }
    if (i > 0) console.log('     |');
  }
  
  await sleep(2000);
}

async function step7_VerifyData() {
  printStep(7, '🔍 Verify Data Integrity');
  
  console.log('\n   Verifying all uploaded data is accessible...\n');
  
  const latestCommit = demoState.commits[demoState.commits.length - 1];
  
  // Download and verify tree
  console.log(`   📥 Downloading tree from Walrus...`);
  const treeData = await downloadFromWalrus(latestCommit.treeBlobId);
  const tree = JSON.parse(treeData);
  
  console.log(`   ✅ Tree verified! Found ${Object.keys(tree).length} files`);
  
  // Verify a random file
  const files = Object.entries(tree);
  const [path, info] = files[Math.floor(Math.random() * files.length)];
  
  console.log(`\n   📥 Verifying random file: ${path}`);
  const fileContent = await downloadFromWalrus(info.blobId);
  
  console.log(`   ✅ File verified! Size: ${fileContent.length} bytes`);
  console.log(`   🔗 Direct access: ${getWalrusViewLink(info.blobId)}`);
  
  await sleep(2000);
}

async function step8_Summary() {
  printStep(8, '🎉 Demo Summary & Verification Links');
  
  console.log('\n   ✨ What we demonstrated:\n');
  console.log('   ✅ Created decentralized repository on Sui blockchain');
  console.log('   ✅ Uploaded real files to Walrus testnet');
  console.log('   ✅ Created multiple commits with version history');
  console.log('   ✅ Retrieved and verified data from Walrus');
  console.log('   ✅ Built complete Git-like DAG structure');
  
  console.log('\n   📊 Statistics:\n');
  console.log(`   Repository ID: ${demoState.repoId}`);
  console.log(`   Total Commits: ${demoState.commits.length}`);
  console.log(`   Total Files: ${demoState.files.length}`);
  console.log(`   Total Size: ${demoState.files.reduce((sum, f) => sum + f.size, 0)} bytes`);
  
  console.log('\n   🔗 Verification Links (Click to verify on Walrus):\n');
  
  console.log('   📄 All Uploaded Files:');
  demoState.files.forEach(file => {
    console.log(`      • ${file.name}: ${file.viewLink}`);
  });
  
  console.log('\n   🌳 All Tree Objects:');
  demoState.commits.forEach((commit, i) => {
    console.log(`      • Commit ${i + 1}: ${getWalrusViewLink(commit.treeBlobId)}`);
  });
  
  console.log('\n   📦 Repository on Sui:');
  console.log(`      • https://suiscan.xyz/testnet/object/${demoState.repoId}`);
  
  console.log('\n   🎯 All data is VERIFIABLE and DECENTRALIZED!');
  console.log('   Anyone can access these Walrus links to verify the data.\n');
}

// ============================================================
// MAIN DEMO
// ============================================================

async function runFullDemo() {
  printHeader('🚀 VERSIONFS - COMPLETE INTERACTIVE DEMO');
  console.log('   Decentralized Version Control System');
  console.log('   Sui Blockchain + Walrus Storage\n');
  
  console.log('   This demo will:');
  console.log('   • Create a real repository on Sui testnet');
  console.log('   • Upload actual files to Walrus testnet');
  console.log('   • Create verifiable commits');
  console.log('   • Show complete version history');
  console.log('   • Provide verification links\n');
  
  await sleep(3000);
  
  try {
    await step1_Initialize();
    const files = await step2_UploadFiles();
    await step3_CreateCommit(files);
    await step4_ViewFile();
    await step5_MakeChanges();
    await step6_ViewHistory();
    await step7_VerifyData();
    await step8_Summary();
    
    printHeader('✅ DEMO COMPLETED SUCCESSFULLY!');
    console.log('   All data has been uploaded to Walrus and is publicly verifiable!');
    console.log('   Repository metadata is stored on Sui blockchain.\n');
    
  } catch (error) {
    console.error('\n❌ Demo Error:', error);
    console.error(error.stack);
  }
}

// Run the demo
if (CONFIG.PACKAGE_ID === "YOUR_PACKAGE_ID") {
  console.log('\n⚠️  Please update CONFIG.PACKAGE_ID with your deployed package ID!\n');
  process.exit(1);
}

runFullDemo();
