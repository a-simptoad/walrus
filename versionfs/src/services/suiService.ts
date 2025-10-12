/**
 * Sui Service - Interact with VersionFS contract on Sui
 */
// import 'dotenv/config';
// const privateKey = process.env.PRIVATE_KEY as string;

/**
 * Sui Service - Interact with VersionFS contract on Sui
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

export interface RepositoryInfo {
  id: string;
  name: string;
  owner: string;
  versionCount: number;
}

export interface VersionInfo {
  versionId: string;
  rootBlobId: string;
  parents: string[];
  author: string;
  timestamp: number;
  message: string;
}

export class SuiService {
  private client: SuiClient;
  private keypair: Ed25519Keypair;
  private packageId: string;

  constructor(
    privateKey: string,
    network: 'testnet' | 'mainnet' = 'testnet',
    packageId?: string
  ) {
    // Initialize Sui client
    this.client = new SuiClient({ url: getFullnodeUrl(network) });

    // Initialize keypair
    const { secretKey } = decodeSuiPrivateKey(privateKey);
    this.keypair = Ed25519Keypair.fromSecretKey(secretKey);

    // Set package ID (replace with actual deployed package ID)
    this.packageId = packageId || 'YOUR_DEPLOYED_PACKAGE_ID';
  }

  getAddress(): string {
    return this.keypair.toSuiAddress();
  }

  /**
   * Create a new repository
   */
  async createRepository(name: string): Promise<string> {
    try {
      console.log(`📦 Creating repository: ${name}`);

      const tx = new Transaction();
      
      tx.moveCall({
        target: `${this.packageId}::version_fs::create_repository`,
        arguments: [
          tx.pure.string(name)
        ],
      });

      const result = await this.client.signAndExecuteTransaction({
        transaction: tx,
        signer: this.keypair,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      });

      console.log('✅ Repository created!');
      console.log('Transaction digest:', result.digest);

      // Extract repository ID from events or object changes
      const repoId = this.extractRepositoryId(result);
      console.log('Repository ID:', repoId);

      return repoId;
    } catch (error) {
      console.error('❌ Error creating repository:', error);
      throw error;
    }
  }

  /**
   * Create a commit
   */
  async commit(
    repoId: string,
    capId: string,
    branchName: string,
    rootBlobId: string,
    parentIds: string[],
    message: string
  ): Promise<string> {
    try {
      console.log(`📝 Creating commit on ${branchName}: ${message}`);

      const tx = new Transaction();

      tx.moveCall({
        target: `${this.packageId}::version_fs::commit`,
        arguments: [
          tx.object(repoId),
          tx.object(capId),
          tx.pure.string(branchName),
          tx.pure.string(rootBlobId),
          tx.pure.vector('id', parentIds), 
          tx.pure.string(message),
        ],
      });

      const result = await this.client.signAndExecuteTransaction({
        transaction: tx,
        signer: this.keypair,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      console.log('✅ Commit created!');
      console.log('Transaction digest:', result.digest);

      // Extract version ID from events
      const versionId = this.extractVersionId(result);
      console.log('Version ID:', versionId);

      return versionId;
    } catch (error) {
      console.error('❌ Error creating commit:', error);
      throw error;
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(
    repoId: string,
    capId: string,
    branchName: string,
    versionId: string
  ): Promise<void> {
    try {
      console.log(`🌿 Creating branch: ${branchName}`);

      const tx = new Transaction();

      tx.moveCall({
        target: `${this.packageId}::version_fs::create_branch`,
        arguments: [
          tx.object(repoId),
          tx.object(capId),
          tx.pure.string(branchName),
          tx.pure.address(versionId),
        ],
      });

      const result = await this.client.signAndExecuteTransaction({
        transaction: tx,
        signer: this.keypair,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      console.log('✅ Branch created!');
      console.log('Transaction digest:', result.digest);
    } catch (error) {
      console.error('❌ Error creating branch:', error);
      throw error;
    }
  }

  /**
   * Get repository information
   */
  async getRepository(repoId: string): Promise<RepositoryInfo> {
    try {
      const object = await this.client.getObject({
        id: repoId,
        options: { showContent: true },
      });

      if (object.data?.content?.dataType !== 'moveObject') {
        throw new Error('Invalid repository object');
      }

      const fields = object.data.content.fields as any;

      return {
        id: repoId,
        name: fields.name,
        owner: fields.owner,
        versionCount: fields.version_count,
      };
    } catch (error) {
      console.error('❌ Error getting repository:', error);
      throw error;
    }
  }

  /**
   * Get branch head
   */
  async getBranchHead(repoId: string, branchName: string): Promise<string> {
    try {
      const tx = new Transaction();

      const [head] = tx.moveCall({
        target: `${this.packageId}::version_fs::get_branch_head`,
        arguments: [
          tx.object(repoId),
          tx.pure.string(branchName),
        ],
      });

      tx.transferObjects([head], this.getAddress());

      const result = await this.client.devInspectTransactionBlock({
        transactionBlock: tx,
        sender: this.getAddress(),
      });

      // Parse result to get version ID
      return this.parseDevInspectResult(result);
    } catch (error) {
      console.error('❌ Error getting branch head:', error);
      throw error;
    }
  }

  /**
   * Get version information
   */
  async getVersion(repoId: string, versionId: string): Promise<VersionInfo> {
    try {
      const tx = new Transaction();

      const [version] = tx.moveCall({
        target: `${this.packageId}::version_fs::get_version`,
        arguments: [
          tx.object(repoId),
          tx.pure.address(versionId),
        ],
      });

      tx.transferObjects([version], tx.pure.address(this.getAddress()));

      const result = await this.client.devInspectTransactionBlock({
        transactionBlock: tx,
        sender: this.getAddress(),
      });

      // Parse result to get version info
      return this.parseVersionInfo(result);
    } catch (error) {
      console.error('❌ Error getting version:', error);
      throw error;
    }
  }

  // Helper methods to extract data from transaction results
  private extractRepositoryId(result: any): string {
    // Look for RepositoryCreated event
    const events = result.events || [];
    for (const event of events) {
      if (event.type.includes('RepositoryCreated')) {
        return event.parsedJson.repo_id;
      }
    }

    // Fallback: look in object changes
    const changes = result.objectChanges || [];
    for (const change of changes) {
      if (change.type === 'created' && change.objectType.includes('Repository')) {
        return change.objectId;
      }
    }

    throw new Error('Could not extract repository ID');
  }

  private extractVersionId(result: any): string {
    // Look for NewCommit event
    const events = result.events || [];
    for (const event of events) {
      if (event.type.includes('NewCommit')) {
        return event.parsedJson.version_id;
      }
    }

    throw new Error('Could not extract version ID');
  }

  private parseDevInspectResult(result: any): string {
    // Parse the result from devInspectTransactionBlock
    // Implementation depends on actual response format
    return result.results?.[0]?.returnValues?.[0]?.[0] || '';
  }

  private parseVersionInfo(result: any): VersionInfo {
    // Parse version info from devInspectTransactionBlock
    // Implementation depends on actual response format
    const data = result.results?.[0]?.returnValues || [];
    
    return {
      versionId: data[0] || '',
      rootBlobId: data[1] || '',
      parents: data[2] || [],
      author: data[3] || '',
      timestamp: data[4] || 0,
      message: data[5] || '',
    };
  }
}

export default SuiService;