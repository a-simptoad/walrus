/**
 * VersionFS Client - High-level API for version control operations
 * Combines Walrus storage with Sui blockchain metadata
 */
import { FileMetadata } from './services/walrusService';


import { WalrusService } from './services/walrusService';
import { SuiService } from './services/suiService';

export interface FileItem {
  path: string;
  name: string;
  type: 'file' | 'directory';
  blobId?: string;
  size?: number;
  children?: Record<string, FileItem>;
}

export interface DirectoryTree {
  [path: string]: FileMetadata;
}

export interface CommitMetadata {
  message: string;
  author: string;
  timestamp: number;
  rootBlobId: string;
  parents: string[];
}

export class VersionFSClient {
  private walrus: WalrusService;
  private sui: SuiService;
  private repoId?: string;
  private capId?: string;

  constructor(
    privateKey: string,
    network: 'testnet' | 'mainnet' = 'testnet',
    packageId?: string
  ) {
    this.walrus = new WalrusService();
    this.sui = new SuiService(privateKey, network, packageId);
  }

  /**
   * Initialize a new repository
   */
  async init(repoName: string): Promise<string> {
    console.log(`\n🚀 Initializing repository: ${repoName}`);
    
    // Create repository on Sui
    this.repoId = await this.sui.createRepository(repoName);
    
    // Create initial empty tree
    const emptyTree: DirectoryTree = {};
    const treeBlobId = await this.walrus.uploadDirectory(emptyTree);
    
    // Create initial commit
    const versionId = await this.sui.commit(
      this.repoId,
      this.capId!,
      'main',
      treeBlobId,
      [],
      'Initial commit'
    );
    
    console.log(`✅ Repository initialized!`);
    console.log(`   Repo ID: ${this.repoId}`);
    console.log(`   Initial commit: ${versionId}`);
    
    return this.repoId;
  }

  /**
   * Add files to staging area and create a commit
   */
  async commit(
    files: Array<{ path: string; data: Uint8Array | string }>,
    message: string,
    branch: string = 'main'
  ): Promise<string> {
    if (!this.repoId) {
      throw new Error('Repository not initialized. Call init() first.');
    }

    console.log(`\n📝 Creating commit: ${message}`);

    // 1. Upload all files to Walrus
    console.log(`📤 Uploading ${files.length} files...`);
    const uploadedFiles: Array<{ path: string; blobId: string; size: number }> = [];
    
    for (const file of files) {
      const data = typeof file.data === 'string' 
        ? new TextEncoder().encode(file.data) 
        : file.data;
      
      const blobId = await this.walrus.uploadFile(data);
      uploadedFiles.push({
        path: file.path,
        blobId,
        size: data.length
      });
      console.log(`   ✓ ${file.path} → ${blobId}`);
    }

    // 2. Build directory tree
    const tree = this.buildDirectoryTree(uploadedFiles);

    // 3. Upload tree to Walrus
    const treeBlobId = await this.walrus.uploadDirectory(tree);
    console.log(`📦 Tree uploaded: ${treeBlobId}`);

    // 4. Get parent commit (current branch head)
    let parents: string[] = [];
    try {
      const parentId = await this.sui.getBranchHead(this.repoId, branch);
      if (parentId) {
        parents = [parentId];
      }
    } catch (error) {
      console.log('   No parent commit (first commit on this branch)');
    }

    // 5. Create commit on Sui
    const versionId = await this.sui.commit(
      this.repoId,
      this.capId!,
      branch,
      treeBlobId,
      parents,
      message
    );

    console.log(`✅ Commit created: ${versionId}`);
    return versionId;
  }

  /**
   * Checkout a specific commit or branch
   */
  async checkout(
    target: string,
    outputDir: string = './checkout'
  ): Promise<void> {
    if (!this.repoId) {
      throw new Error('Repository not initialized.');
    }

    console.log(`\n🔄 Checking out: ${target}`);

    // Try to get as branch first, then as version ID
    let versionId: string;
    try {
      versionId = await this.sui.getBranchHead(this.repoId, target);
      console.log(`   Branch '${target}' → ${versionId}`);
    } catch {
      versionId = target;
      console.log(`   Using version ID: ${versionId}`);
    }

    // Get version info
    const version = await this.sui.getVersion(this.repoId, versionId);
    console.log(`   Message: ${version.message}`);
    console.log(`   Author: ${version.author}`);
    console.log(`   Timestamp: ${new Date(version.timestamp * 1000).toISOString()}`);

    // Download tree
    const tree = await this.walrus.downloadDirectory(version.rootBlobId);
    console.log(`📥 Downloading ${Object.keys(tree).length} files...`);

    // Download all files
    for (const [path, fileInfo] of Object.entries(tree)) {
      if (fileInfo.type === 'file' && fileInfo.blobId) {
        const data = await this.walrus.downloadFile(fileInfo.blobId);
        const fullPath = `${outputDir}/${path}`;
        
        // Create directory if needed
        const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
        if (dir && typeof window === 'undefined') {
          const fs = await import('fs');
          const path = await import('path');
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(fullPath, data);
          console.log(`   ✓ ${path}`);
        }
      }
    }

    console.log(`✅ Checkout complete in: ${outputDir}`);
  }

  /**
   * Create a new branch
   */
  async createBranch(
    branchName: string,
    fromVersion?: string
  ): Promise<void> {
    if (!this.repoId) {
      throw new Error('Repository not initialized.');
    }

    console.log(`\n🌿 Creating branch: ${branchName}`);

    // If no version specified, use current main head
    let versionId = fromVersion;
    if (!versionId) {
      versionId = await this.sui.getBranchHead(this.repoId, 'main');
    }

    await this.sui.createBranch(this.repoId, this.capId!, branchName, versionId);
    console.log(`✅ Branch '${branchName}' created at ${versionId}`);
  }

  /**
   * Get commit history
   */
  async log(branch: string = 'main', limit: number = 10): Promise<CommitMetadata[]> {
    if (!this.repoId) {
      throw new Error('Repository not initialized.');
    }

    console.log(`\n📜 Commit history for '${branch}':`);

    const commits: CommitMetadata[] = [];
    let currentId = await this.sui.getBranchHead(this.repoId, branch);
    let count = 0;

    while (currentId && count < limit) {
      const version = await this.sui.getVersion(this.repoId, currentId);
      
      const commit: CommitMetadata = {
        message: version.message,
        author: version.author,
        timestamp: version.timestamp,
        rootBlobId: version.rootBlobId,
        parents: version.parents
      };

      commits.push(commit);
      
      console.log(`\n  ${currentId.substring(0, 8)}`);
      console.log(`  Author: ${commit.author}`);
      console.log(`  Date: ${new Date(commit.timestamp * 1000).toISOString()}`);
      console.log(`  Message: ${commit.message}`);

      // Move to parent
      if (version.parents.length > 0) {
        currentId = version.parents[0];
      } else {
        break;
      }
      count++;
    }

    return commits;
  }

  /**
   * Get file content at specific version
   */
  async cat(filePath: string, version?: string, branch: string = 'main'): Promise<string> {
    if (!this.repoId) {
      throw new Error('Repository not initialized.');
    }

    // Get version ID
    let versionId = version;
    if (!versionId) {
      versionId = await this.sui.getBranchHead(this.repoId, branch);
    }

    // Get version and tree
    const versionInfo = await this.sui.getVersion(this.repoId, versionId);
    const tree = await this.walrus.downloadDirectory(versionInfo.rootBlobId);

    // Find file
    const fileInfo = tree[filePath];
    if (!fileInfo || fileInfo.type !== 'file' || !fileInfo.blobId) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Download and return content
    const data = await this.walrus.downloadFile(fileInfo.blobId);
    return new TextDecoder().decode(data);
  }

  /**
   * Compare two versions (simplified diff)
   */
  async diff(version1: string, version2: string): Promise<void> {
    if (!this.repoId) {
      throw new Error('Repository not initialized.');
    }

    console.log(`\n📊 Comparing ${version1.substring(0, 8)}...${version2.substring(0, 8)}`);

    const v1 = await this.sui.getVersion(this.repoId, version1);
    const v2 = await this.sui.getVersion(this.repoId, version2);

    const tree1 = await this.walrus.downloadDirectory(v1.rootBlobId);
    const tree2 = await this.walrus.downloadDirectory(v2.rootBlobId);

    const allPaths = new Set([...Object.keys(tree1), ...Object.keys(tree2)]);

    for (const path of allPaths) {
      const file1 = tree1[path];
      const file2 = tree2[path];

      if (!file1) {
        console.log(`  + ${path} (added)`);
      } else if (!file2) {
        console.log(`  - ${path} (deleted)`);
      } else if (file1.blobId !== file2.blobId) {
        console.log(`  M ${path} (modified)`);
      }
    }
  }

  /**
   * Get repository status
   */
  async status(): Promise<void> {
    if (!this.repoId) {
      throw new Error('Repository not initialized.');
    }

    const repo = await this.sui.getRepository(this.repoId);
    console.log(`\n📊 Repository Status`);
    console.log(`   Name: ${repo.name}`);
    console.log(`   Owner: ${repo.owner}`);
    console.log(`   Total commits: ${repo.versionCount}`);
    console.log(`   Repo ID: ${this.repoId}`);
  }

  /**
   * Set repository and capability IDs (for existing repos)
   */
  setRepoIds(repoId: string, capId: string): void {
    this.repoId = repoId;
    this.capId = capId;
  }

  /**
   * Build directory tree from file list
   */
  private buildDirectoryTree(
    files: Array<{ path: string; blobId: string; size: number }>
  ): DirectoryTree {
    const tree: DirectoryTree = {};

    for (const file of files) {
      const parts = file.path.split('/');
      const fileName = parts[parts.length - 1];

      tree[file.path] = {
        path: file.path,
        name: fileName,
        type: 'file',
        blobId: file.blobId,
        size: file.size
      };
    }

    return tree;
  }
}

export default VersionFSClient;