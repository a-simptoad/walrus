/**
 * VersionFS Client - High-level API for version control operations.
 * This client orchestrates calls to both the Sui blockchain and Walrus storage.
 */
import { WalrusService, type FileMetadata } from '../../versionfs/src/services/walrusService'; // Adjust path if needed
import { 
    SuiService, 
    type SignAndExecuteFunction, 
    type VersionInfo 
} from '../../versionfs/src/services/suiService';

// --- INTERFACES ---
export interface DirectoryTree {
  [path: string]: FileMetadata;
}

export interface CommitMetadata extends VersionInfo {}

// --- VERSIONFS CLIENT CLASS ---
export class VersionFSClient {
  private walrus: WalrusService;
  private sui: SuiService;
  
  // These will be set when a repository is initialized or loaded.
  private repoId?: string;
  private capId?: string;

  /**
   * CONSTRUCTOR
   * @param signAndExecute The `mutateAsync` function from the `useSignAndExecuteTransaction` hook.
   * @param address The address of the currently connected wallet account.
   */
  constructor(
    signAndExecute: SignAndExecuteFunction,
    address: string
  ) {
    this.walrus = new WalrusService();
    // Initialize SuiService by passing the wallet's function and address down.
    this.sui = new SuiService(signAndExecute, address);
  }
  
  /**
   * Exposes the underlying SuiService instance for direct read calls if needed by the UI.
   */
  public getSuiService(): SuiService {
    return this.sui;
  }

  /**
   * Manually sets the repository and owner capability IDs.
   * Useful for interacting with a repository that has already been created.
   */
  setRepoIds(repoId: string, capId: string): void {
    this.repoId = repoId;
    this.capId = capId;
    console.log(`Client is now targeting Repo ID: ${repoId}`);
  }

  /**
   * Initializes a new repository.
   * This involves creating the repository object on-chain and making the initial commit.
   * @param repoName The name for the new repository.
   * @returns The ID of the newly created repository.
   */
  async init(repoName: string): Promise<string> {
    console.log(`🚀 Initializing repository: ${repoName}`);
    
    // 1. Create the repository object and get its ID and the associated OwnerCap ID.
    const { repoId, capId } = await this.sui.createRepository(repoName);
    this.repoId = repoId;
    this.capId = capId;
    
    console.log(`✅ Repository object created: ${repoId}`);
    console.log(`🔑 OwnerCap ID: ${capId} (IMPORTANT: Store this securely for future write access)`);

    // 2. Create and upload an empty directory tree for the initial commit.
    const emptyTree: DirectoryTree = {};
    const treeBlobId = await this.walrus.uploadDirectory(emptyTree);
    console.log(`🌳 Initial empty tree uploaded: ${treeBlobId}`);

    // 3. Create the very first commit on the 'main' branch.
    const versionId = await this.sui.commit(
      this.repoId,
      this.capId,
      'main',
      treeBlobId,
      [], // No parents for the first commit
      'Initial commit'
    );
    
    console.log(`🎉 Repository initialized successfully! Initial commit ID: ${versionId}`);
    return this.repoId || '';
  }

  /**
   * Creates a new commit with the given files and message.
   * @param files An array of file objects with their path and data.
   * @param message The commit message.
   * @param branch The branch to commit to (defaults to 'main').
   * @returns The ID of the new version/commit.
   */
  async commit(files: Array<{ path: string; data: Uint8Array | string }>, message: string, branch: string = 'main'): Promise<string> {
    if (!this.repoId || !this.capId) {
      throw new Error('Repository or OwnerCap ID is not set. Call init() or setRepoIds() first.');
    }

    console.log(`📝 Committing to branch '${branch}': ${message}`);

    // 1. Upload all files to Walrus storage.
    const uploadedFiles: Array<{ path: string; blobId: string; size: number }> = [];
    for (const file of files) {
      const data = typeof file.data === 'string' 
        ? new TextEncoder().encode(file.data) 
        : file.data;
      const blobId = await this.walrus.uploadFile(data);
      uploadedFiles.push({ path: file.path, blobId, size: data.length });
    }

    // 2. Build and upload the directory tree file.
    const tree = this.buildDirectoryTree(uploadedFiles);
    const treeBlobId = await this.walrus.uploadDirectory(tree);
    console.log(`📦 New tree uploaded: ${treeBlobId}`);

    // 3. Get the current head of the branch to use as the parent for this commit.
    let parents: string[] = [];
    try {
      const parentId = await this.sui.getBranchHead(this.repoId, branch);
      if (parentId) parents = [parentId];
    } catch (error) {
      console.log(`No parent commit found on branch '${branch}'. This will be the first.`);
    }

    // 4. Call SuiService to create the commit object on-chain.
    const versionId = await this.sui.commit(
      this.repoId,
      this.capId,
      branch,
      treeBlobId,
      parents,
      message
    );

    console.log(`✅ Commit created successfully! Version ID: ${versionId}`);
    return versionId;
  }

  /**
   * Retrieves the commit history for a specific branch.
   * @param branch The branch to get the log for.
   * @param limit The maximum number of commits to return.
   * @returns A promise that resolves to an array of commit metadata.
   */
  async log(branch: string = 'main', limit: number = 10): Promise<CommitMetadata[]> {
    if (!this.repoId) {
      throw new Error('Repository not initialized.');
    }

    const commits: CommitMetadata[] = [];
    let currentId = await this.sui.getBranchHead(this.repoId, branch);
    console.log(`Fetching up to ${limit} commits from branch '${branch}' starting at ${currentId}`);
    
    for (let i = 0; i < limit && currentId; i++) {
      const version = await this.sui.getVersion(this.repoId, currentId);
      commits.push(version);
      
      // Move to the first parent for the next iteration.
      currentId = version.parents.length > 0 ? version.parents[0] : '';
    }
    
    return commits;
  }

  /**
   * A private helper method to construct the directory tree object from a flat list of files.
   */
  private buildDirectoryTree(files: Array<{ path: string; blobId: string; size: number }>): DirectoryTree {
    const tree: DirectoryTree = {};
    for (const file of files) {
      tree[file.path] = {
        path: file.path,
        name: file.path.split('/').pop() || '',
        type: 'file',
        blobId: file.blobId,
        size: file.size,
      };
    }
    return tree;
  }
}

