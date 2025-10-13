/**
 * Sui Service - Interacts with the VersionFS contract on Sui.
 * This class is designed to be given wallet details from a React component.
 */
import { 
    SuiClient, 
    getFullnodeUrl, 
    type SuiObjectChange, 
    type SuiEvent, 
    type SuiTransactionBlockResponse 
} from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

// --- TYPE DEFINITIONS to match @mysten/dapp-kit hook output ---
export interface DappKitTransactionOutput {
    digest: string;
    objectChanges?: SuiObjectChange[];
    events?: SuiEvent[];
}

export type SignAndExecuteFunction = (transaction: {
    transaction: Transaction;
    options?: { showEffects?: boolean; showEvents?: boolean; showObjectChanges?: boolean; };
}) => Promise<DappKitTransactionOutput>;

// --- INTERFACES ---
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


// --- SUI SERVICE CLASS ---
export class SuiService {
    private client: SuiClient;
    private packageId: string;

    private signAndExecuteTransaction: SignAndExecuteFunction;
    private currentAddress: string;

    constructor(
        signAndExecute: SignAndExecuteFunction,
        address: string,
        network: 'testnet' | 'mainnet' = 'testnet',
        packageId?: string
    ) {
        this.client = new SuiClient({ url: getFullnodeUrl(network) });
        this.signAndExecuteTransaction = signAndExecute;
        this.currentAddress = address;
        // IMPORTANT: Replace with your actual deployed package ID
        this.packageId = packageId || '0xf52972b9a7ea5ec2a8582777bd852f80c6c3d550a28242e5ef44e25320663e2e';
    }

    getAddress(): string {
        return this.currentAddress;
    }

    // --- WRITE METHODS (require wallet signature) ---

    async createRepository(name: string): Promise<{ repoId: string, capId: string }> {
        const tx = new Transaction();
        tx.moveCall({
            target: `${this.packageId}::version_fs::create_repository`,
            arguments: [tx.pure.string(name)],
        });

        // Step 1: Execute the transaction and get the digest.
        const result = await this.signAndExecuteTransaction({ transaction: tx });
        const { digest } = result;
        console.log(`Transaction submitted with digest: ${digest}`);

        // Step 2: Fetch transaction details using the digest, with retries for network indexing delay.
        const MAX_RETRIES = 5;
        const RETRY_DELAY_MS = 1000; // 1 second

        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                const txDetails = await this.client.getTransactionBlock({
                    digest: digest,
                    options: { showObjectChanges: true },
                });

                let repoId: string | undefined;
                let capId: string | undefined;

                if (txDetails.objectChanges) {
                    for (const change of txDetails.objectChanges) {
                        if (change.type === 'created') {
                            if (change.objectType.includes('::version_fs::Repository')) {
                                repoId = change.objectId;
                            } else if (change.objectType.includes('::version_fs::RepoCap')) {
                                capId = change.objectId;
                            }
                        }
                    }
                }

                if (repoId && capId) {
                    console.log(`Successfully found created objects: Repo ID - ${repoId}, Cap ID - ${capId}`);
                    return { repoId, capId };
                }

            } catch (error: any) {
                if (error.message.includes('Could not find the referenced transaction')) {
                    console.log(`Attempt ${i + 1}: Transaction not indexed yet. Retrying in ${RETRY_DELAY_MS}ms...`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                } else {
                    throw error;
                }
            }
        }
        
        throw new Error(`Failed to find transaction details for digest ${digest} after ${MAX_RETRIES} attempts.`);
    }

    async commit(repoId: string, capId: string, branchName: string, rootBlobId: string, parentIds: string[], message: string): Promise<string> {
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

        const result = await this.signAndExecuteTransaction({ transaction: tx, options: { showEvents: true } });
        return this.extractVersionId(result);
    }

    async createBranch(repoId: string, capId: string, branchName: string, versionId: string): Promise<void> {
        const tx = new Transaction();
        tx.moveCall({
            target: `${this.packageId}::version_fs::create_branch`,
            arguments: [
                tx.object(repoId),
                tx.object(capId),
                tx.pure.string(branchName),
                tx.pure.id(versionId),
            ],
        });
        await this.signAndExecuteTransaction({ transaction: tx });
    }

    // --- READ METHODS (do not require wallet signature) ---
    
    async getRepositoriesByOwner(): Promise<RepositoryInfo[]> {
        const repoObjectType = `${this.packageId}::version_fs::Repository`;
        const ownedObjects = await this.client.getOwnedObjects({
            owner: this.currentAddress,
            filter: { StructType: repoObjectType },
            options: { showContent: true },
        });

        return ownedObjects.data.map(repo => {
            if (repo.data?.content?.dataType === 'moveObject') {
                const fields = repo.data.content.fields as any;
                return {
                    id: fields.id.id,
                    name: fields.name,
                    owner: fields.owner,
                    versionCount: parseInt(fields.version_count, 10),
                };
            }
            return null;
        }).filter((repo): repo is RepositoryInfo => repo !== null);
    }

    async getRepository(repoId: string): Promise<RepositoryInfo> {
        const object = await this.client.getObject({
            id: repoId,
            options: { showContent: true },
        });

        if (object.data?.content?.dataType !== 'moveObject') {
            throw new Error('Invalid repository object');
        }
        const fields = object.data.content.fields as any;
        return {
            id: fields.id.id,
            name: fields.name,
            owner: fields.owner,
            versionCount: parseInt(fields.version_count, 10),
        };
    }
  
    async getBranchHead(repoId: string, branchName: string): Promise<string> {
        const tx = new Transaction();
        tx.moveCall({
          target: `${this.packageId}::version_fs::get_branch_head`,
          arguments: [tx.object(repoId), tx.pure.string(branchName)],
        });
        
        const result = await this.client.devInspectTransactionBlock({
          transactionBlock: tx,
          sender: this.currentAddress,
        });
        
        return this.parseDevInspectResult(result) as string;
    }

    async getVersion(repoId: string, versionId: string): Promise<VersionInfo> {
        const tx = new Transaction();
        tx.moveCall({
          target: `${this.packageId}::version_fs::get_version`,
          arguments: [tx.object(repoId), tx.pure.id(versionId)],
        });

        const result = await this.client.devInspectTransactionBlock({
          transactionBlock: tx,
          sender: this.currentAddress,
        });
        
        return this.parseVersionInfo(result);
    }

    // --- PRIVATE HELPER METHODS ---

    private extractVersionId(result: DappKitTransactionOutput): string {
        const event = result.events?.find(e => e.type.includes('NewCommit'));
        if (event && event.parsedJson) {
            return (event.parsedJson as { version_id: string }).version_id;
        }
        throw new Error('Could not extract version ID from transaction events.');
    }

    private parseDevInspectResult(result: any): any {
        const returnValues = result.results?.[0]?.returnValues;
        if (!returnValues || returnValues.length === 0) {
            throw new Error('No return value from devInspect');
        }
        const bytes = returnValues[0][0];
        // This assumes the return value is a string or an ID that can be decoded.
        return new TextDecoder().decode(new Uint8Array(bytes));
    }

    private parseVersionInfo(result: any): VersionInfo {
        const returnValues = result.results?.[0]?.returnValues;
        if (!returnValues) {
            throw new Error('Could not parse version info from devInspect result.');
        }
        
        // This structure assumes your contract returns a tuple of the version's fields.
        // The indices must match your contract's return signature.
        const decode = (val: any) => new TextDecoder().decode(new Uint8Array(val[0]));

        return {
            versionId: decode(returnValues[0]),
            rootBlobId: decode(returnValues[1]),
            parents: JSON.parse(decode(returnValues[2])), // Assuming parents are a JSON string array
            author: decode(returnValues[3]),
            timestamp: parseInt(decode(returnValues[4]), 10),
            message: decode(returnValues[5]),
        };
    }
}

