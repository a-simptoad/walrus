/**
 * VersionFS Usage Examples
 * Complete examples showing how to use the version control system
 */

import VersionFSClient from './versionFSClient';
import { WalrusService } from './services/walrusService';

// Your Sui private key
const PRIVATE_KEY = "suiprivkey1qraghhjntc5dx59wuwqrj48tq35lnrlre0nr966gerucrmycexanvh9j845";

// Your deployed package ID (replace after deployment)
const PACKAGE_ID = "0x907d59aac05dcd70b0189189a85a5abd648a08947d44b98aa2a2fe2eeadc41c6";

// ==================== Example 1: Initialize Repository ====================
async function example1_InitRepository() {
  console.log("=".repeat(50));
  console.log("Example 1: Initialize Repository");
  console.log("=".repeat(50));

  const client = new VersionFSClient(PRIVATE_KEY, 'testnet', PACKAGE_ID);
  
  // Initialize a new repository
  const repoId = await client.init("my-awesome-project");
  
  console.log(`\n🎉 Repository created with ID: ${repoId}`);
  console.log("   Save this ID to interact with your repo later!");
  
  return repoId;
}

// ==================== Example 2: Create First Commit ====================
async function example2_FirstCommit(repoId: string, capId: string) {
  console.log("\n" + "=".repeat(50));
  console.log("Example 2: Create First Commit");
  console.log("=".repeat(50));

  const client = new VersionFSClient(PRIVATE_KEY, 'testnet', PACKAGE_ID);
  client.setRepoIds(repoId, capId);

  // Create some files
  const files = [
    {
      path: 'README.md',
      data: '# My Awesome Project\n\nThis is stored on Walrus!'
    },
    {
      path: 'src/main.ts',
      data: 'console.log("Hello from Walrus!");'
    },
    {
      path: 'package.json',
      data: JSON.stringify({
        name: 'my-project',
        version: '1.0.0',
        description: 'Decentralized project'
      }, null, 2)
    }
  ];

  // Commit files
  const versionId = await client.commit(files, 'Initial commit with basic files');
  
  console.log(`\n✅ First commit created: ${versionId}`);
  
  return versionId;
}

// ==================== Example 3: Make Changes ====================
async function example3_MakeChanges(repoId: string, capId: string) {
  console.log("\n" + "=".repeat(50));
  console.log("Example 3: Make Changes");
  console.log("=".repeat(50));

  const client = new VersionFSClient(PRIVATE_KEY, 'testnet', PACKAGE_ID);
  client.setRepoIds(repoId, capId);

  // Add a new file and modify existing
  const files = [
    {
      path: 'README.md',
      data: '# My Awesome Project\n\nNow with more features!\n\n## Features\n- Decentralized\n- Version controlled'
    },
    {
      path: 'src/utils.ts',
      data: 'export function greet(name: string) {\n  return `Hello, ${name}!`;\n}'
    }
  ];

  const versionId = await client.commit(files, 'Add utils and update README');
  
  console.log(`\n✅ Changes committed: ${versionId}`);
  
  return versionId;
}

// ==================== Example 4: View History ====================
async function example4_ViewHistory(repoId: string, capId: string) {
  console.log("\n" + "=".repeat(50));
  console.log("Example 4: View History");
  console.log("=".repeat(50));

  const client = new VersionFSClient(PRIVATE_KEY, 'testnet', PACKAGE_ID);
  client.setRepoIds(repoId, capId);

  await client.log('main', 10);
}

// ==================== Example 5: Create Branch ====================
async function example5_CreateBranch(repoId: string, capId: string) {
  console.log("\n" + "=".repeat(50));
  console.log("Example 5: Create Branch");
  console.log("=".repeat(50));

  const client = new VersionFSClient(PRIVATE_KEY, 'testnet', PACKAGE_ID);
  client.setRepoIds(repoId, capId);

  // Create a feature branch
  await client.createBranch('feature/new-api');
  
  // Make changes on the new branch
  const files = [
    {
      path: 'src/api.ts',
      data: 'export class API {\n  async fetch(url: string) {\n    return await fetch(url);\n  }\n}'
    }
  ];

  const versionId = await client.commit(files, 'Add API module', 'feature/new-api');
  
  console.log(`\n✅ Feature branch updated: ${versionId}`);
}

// ==================== Example 6: Checkout Version ====================
async function example6_Checkout(repoId: string, capId: string, versionId: string) {
  console.log("\n" + "=".repeat(50));
  console.log("Example 6: Checkout Version");
  console.log("=".repeat(50));

  const client = new VersionFSClient(PRIVATE_KEY, 'testnet', PACKAGE_ID);
  client.setRepoIds(repoId, capId);

  // Checkout specific version
  await client.checkout(versionId, './checkout-v1');
  
  // Or checkout branch
  await client.checkout('main', './checkout-main');
}

// ==================== Example 7: View File Content ====================
async function example7_ViewFile(repoId: string, capId: string) {
  console.log("\n" + "=".repeat(50));
  console.log("Example 7: View File Content");
  console.log("=".repeat(50));

  const client = new VersionFSClient(PRIVATE_KEY, 'testnet', PACKAGE_ID);
  client.setRepoIds(repoId, capId);

  // Get file content from latest commit
  const content = await client.cat('README.md');
  console.log('\n📄 README.md:\n');
  console.log(content);
}

// ==================== Example 8: Compare Versions ====================
async function example8_Diff(repoId: string, capId: string, v1: string, v2: string) {
  console.log("\n" + "=".repeat(50));
  console.log("Example 8: Compare Versions");
  console.log("=".repeat(50));

  const client = new VersionFSClient(PRIVATE_KEY, 'testnet', PACKAGE_ID);
  client.setRepoIds(repoId, capId);

  await client.diff(v1, v2);
}

// ==================== Example 9: Repository Status ====================
async function example9_Status(repoId: string, capId: string) {
  console.log("\n" + "=".repeat(50));
  console.log("Example 9: Repository Status");
  console.log("=".repeat(50));

  const client = new VersionFSClient(PRIVATE_KEY, 'testnet', PACKAGE_ID);
  client.setRepoIds(repoId, capId);

  await client.status();
}

// ==================== Example 10: Direct Walrus Upload/Download ====================
async function example10_DirectWalrus() {
  console.log("\n" + "=".repeat(50));
  console.log("Example 10: Direct Walrus Operations");
  console.log("=".repeat(50));

  const walrus = new WalrusService();

  // Upload a file
  const data = "This is a test file for Walrus!";
  const blobId = await walrus.uploadFile(data, 3);
  console.log(`\n✅ Uploaded to Walrus: ${blobId}`);

  // Download the file
  const downloaded = await walrus.downloadFile(blobId);
  const text = new TextDecoder().decode(downloaded);
  console.log(`\n📥 Downloaded content: ${text}`);

  // Check if blob exists
  const exists = await walrus.blobExists(blobId);
  console.log(`\n✓ Blob exists: ${exists}`);

  return blobId;
}

// ==================== Complete Workflow Example ====================
async function completeWorkflow() {
  console.log("\n" + "=".repeat(70));
  console.log("COMPLETE VERSIONFS WORKFLOW");
  console.log("=".repeat(70));

  try {
    // Step 1: Initialize
    const repoId = await example1_InitRepository();
    const capId = "YOUR_CAP_ID"; // You'll get this from transaction output

    // Step 2: First commit
    const v1 = await example2_FirstCommit(repoId, capId);
    
    // Step 3: Make changes
    const v2 = await example3_MakeChanges(repoId, capId);
    
    // Step 4: View history
    await example4_ViewHistory(repoId, capId);
    
    // Step 5: Create feature branch
    await example5_CreateBranch(repoId, capId);
    
    // Step 6: View current status
    await example9_Status(repoId, capId);
    
    // Step 7: Compare versions
    await example8_Diff(repoId, capId, v1, v2);
    
    // Step 8: View file
    await example7_ViewFile(repoId, capId);
    
    console.log("\n" + "=".repeat(70));
    console.log("✅ WORKFLOW COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(70));
    
  } catch (error) {
    console.error("\n❌ Error in workflow:", error);
  }
}

// ==================== CLI Interface ====================
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    console.log(`
VersionFS CLI - Decentralized Version Control

Usage: npm run example <command>

Commands:
  init              Initialize a new repository
  commit <repo>     Create a commit
  log <repo>        View commit history
  branch <repo>     Create a branch
  checkout <repo>   Checkout a version
  status <repo>     View repository status
  diff <repo>       Compare two versions
  cat <repo>        View file content
  walrus            Test Walrus upload/download
  workflow          Run complete workflow

Examples:
  npm run example init
  npm run example commit 0x123...
  npm run example log 0x123...
    `);
    return;
  }

  switch (command) {
    case 'init':
      await example1_InitRepository();
      break;
    case 'commit':
      await example2_FirstCommit(args[1], args[2]);
      break;
    case 'log':
      await example4_ViewHistory(args[1], args[2]);
      break;
    case 'branch':
      await example5_CreateBranch(args[1], args[2]);
      break;
    case 'status':
      await example9_Status(args[1], args[2]);
      break;
    case 'walrus':
      await example10_DirectWalrus();
      break;
    case 'workflow':
      await completeWorkflow();
      break;
    default:
      console.log(`Unknown command: ${command}`);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  example1_InitRepository,
  example2_FirstCommit,
  example3_MakeChanges,
  example4_ViewHistory,
  example5_CreateBranch,
  example6_Checkout,
  example7_ViewFile,
  example8_Diff,
  example9_Status,
  example10_DirectWalrus,
  completeWorkflow
};