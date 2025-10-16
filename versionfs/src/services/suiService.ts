/**
 * Sui Service - Interacts with the VersionFS contract on Sui.
 * This class is designed to be given wallet details from a React component.
 */
import { 
    SuiClient, 
    getFullnodeUrl, 
    type SuiObjectChange, 
    type SuiEvent, 
} from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { BcsReader } from '@mysten/bcs';

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

        let repoId: string | undefined;
        let capId: string | undefined;
        let count = 5;

        do {
            count--;
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
                const resultObj = await this.getRepoAndCapId(digest);
                repoId = resultObj.repoId;
                capId = resultObj.capId;
                if (repoId && capId) {
                    console.log(`Successfully found created objects: Repo ID - ${repoId}, Cap ID - ${capId}`);
                    return { repoId, capId };
                }
            } catch (error: any) {
                if (error.message.includes('Could not find the referenced transaction')) {
                    console.log(`Transaction not indexed yet.`);
                } else {
                    throw error;
                }
            }
        } while (count == 0);
        
      throw new Error(`Failed to find transaction details for digest ${digest}.`);
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
        console.log(`Commit transaction submitted with digest: ${result}`);
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
        try {
            // Step 1: Build the transaction plan to call the get_version function.
            const tx = new Transaction();
            tx.moveCall({
                target: `${this.packageId}::version_fs::get_version`,
                arguments: [tx.object(repoId), tx.pure.id(versionId)],
            });

            // Step 2: Simulate the transaction to get the raw, serialized return value.
            const result = await this.client.devInspectTransactionBlock({
                transactionBlock: tx,
                sender: this.currentAddress,
            });
            
            // Step 3: Extract the raw bytes from the response.
            const returnValues = result.results?.[0]?.returnValues;
            console.log(`Dev inspect result for getVersion: ${JSON.stringify(result)}`);
            console.log(`Return values: ${JSON.stringify(returnValues)}`);
            if (!returnValues || returnValues.length === 0) {
                throw new Error('No return value found for getVersion.');
            }

            const [bytes, moveType] = returnValues[0];
            if (!moveType.includes('::version_fs::VersionNode')) {
                throw new Error(`Expected VersionNode struct, but got ${moveType}`);
            }

            // Step 4: Manually parse the VersionNode struct using BcsReader.
            // The order of these reads must EXACTLY match the order of fields in your Move struct definition.
            const reader = new BcsReader(new Uint8Array(bytes));

            // CORRECTED ORDER: The RangeError suggests the parser was misaligned.
            // It was likely trying to read a string where the vector of parents was located.
            const rootBlobIdResult = readString(reader);
            
            // For the vector of parents, first read its length, then loop to read each ID.
            const parentCount = reader.readULEB();
            const parentsResult: string[] = [];
            for (let i = 0; i < parentCount; i++) {
                parentsResult.push(readAddress(reader));
            }

            const authorResult = readAddress(reader);
            const timestampResult = readU64(reader);
            const messageResult = readString(reader);
            const versionIdResult = readAddress(reader);

            return {
                versionId: versionIdResult,
                rootBlobId: rootBlobIdResult,
                parents: parentsResult,
                author: authorResult,
                timestamp: timestampResult,
                message: messageResult,
            };

        } catch (error) {
            console.error("Failed to get version info via devInspect and manual parse:", error);
            throw error;
        }
    }

    // --- PRIVATE HELPER METHODS ---

    private async getRepoAndCapId(digest: string): Promise<{ repoId: string, capId: string }> {
        await new Promise(resolve => setTimeout(resolve, 500));

        const txDetails = await this.client.getTransactionBlock({
            digest: digest,
            options: { showObjectChanges: true, showEvents: true }
        });

        let repoId: string | undefined;
        let capId: string | undefined;

        if (!txDetails) {
            throw new Error(`Failed to find transaction details for digest ${digest}.`);
        }

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

        return { repoId: repoId || '', capId: capId || '' };
    }

    private async extractVersionId(result: DappKitTransactionOutput): Promise<string> {
        const { digest } = result;
        await new Promise(resolve => setTimeout(resolve, 500));
        const txDetails = await this.client.getTransactionBlock({
            digest: digest,
            options: { showObjectChanges: true, showEvents: true }
        });

        let versionId;

        if (!txDetails) {
            throw new Error(`Failed to find transaction details for digest ${digest}.`);
        }
        if (txDetails.events) {
            for (const event of txDetails.events) {
                if (event.type === `${this.packageId}::version_fs::CommitEvent`) {
                    versionId = (event.parsedJson as any).version_id;
                    console.log(`CommitEvent found! Version ID: ${versionId}`);
                }
            }
        }
        return versionId || '';
    }

    private parseDevInspectResult(result: any): any {
        const returnValues = result.results?.[0]?.returnValues;

        if (!returnValues || returnValues.length === 0) {
            throw new Error('No return value found in devInspect result.');
        }

        // The return value is a tuple: [raw_bytes, move_type_string]
        const [bytes, moveType] = returnValues[0];
        const uint8Bytes = new Uint8Array(bytes);

        console.log(`Decoding devInspect result of type: ${moveType}`);

        // Use the correct "tool" based on the data type
        switch (moveType) {
            case 'address':
            case '0x2::object::ID':
                // Addresses and IDs are 32-byte hex strings
                return bytesToHex(uint8Bytes);

            case 'u64':
                // Use DataView to correctly read a 64-bit little-endian integer
                // Returned as a string to avoid JavaScript's number precision limits
                if (uint8Bytes.length !== 8) throw new Error('Invalid u64 byte length');
                const dataView = new DataView(uint8Bytes.buffer);
                return dataView.getBigUint64(0, true).toString(); // true for little-endian

            case 'bool':
                // A boolean is a single byte: 1 for true, 0 for false
                return uint8Bytes[0] === 1;

            case 'vector<u8>':
                // This is the one case where TextDecoder is appropriate, for strings
                try {
                    return new TextDecoder("utf-8", { fatal: true }).decode(uint8Bytes);
                } catch (e) {
                    // If it's not a valid UTF-8 string, fall back to hex
                    console.warn("devInspect returned vector<u8> that was not a valid string. Falling back to hex.");
                    return bytesToHex(uint8Bytes);
                }

            default:
                // For any other type, we'll return the hex representation as a safe default
                console.warn(`Unhandled devInspect type: '${moveType}'. Returning as hex.`);
                return bytesToHex(uint8Bytes);
        }
    }

    // private parseVersionInfo(result: any): VersionInfo {
    //     const returnValues = result.results?.[0]?.returnValues;

    //     if (!returnValues || returnValues.length < 6) {
    //         throw new Error('Could not parse version info: expected at least 6 return values.');
    //     }

    //     // --- Internal Helper to Decode a Single Value ---
    //     // This function takes a single [bytes, moveType] tuple and decodes it.
    //     const decodeValue = (valueTuple: [number[], string]): any => {
    //         const [bytes, moveType] = valueTuple;
    //         const uint8Bytes = new Uint8Array(bytes);

    //         switch (moveType) {
    //             case 'address':
    //             case '0x2::object::ID':
    //                 return bytesToHex(uint8Bytes);

    //             case 'u64':
    //                 const dataView = new DataView(uint8Bytes.buffer);
    //                 // Use getBigUint64 for precision and convert to a number.
    //                 // Note: This may lose precision if the timestamp is extremely large.
    //                 return Number(dataView.getBigUint64(0, true)); // true for little-endian

    //             case 'vector<u8>':
    //                 return new TextDecoder().decode(uint8Bytes);

    //             // This handles the case for a vector of addresses/IDs
    //             case 'vector<address>':
    //             case 'vector<0x2::object::ID>':
    //                 const parents: string[] = [];
    //                 // A vector is encoded with its length first (as a ULEB number),
    //                 // followed by the raw bytes of its elements.
    //                 // This is a simplified parser that assumes the first byte is the length.
    //                 const length = uint8Bytes[0];
    //                 for (let i = 0; i < length; i++) {
    //                     const start = 1 + i * 32; // 1 byte for length, then 32 bytes per address
    //                     const end = start + 32;
    //                     if (uint8Bytes.length >= end) {
    //                         parents.push(bytesToHex(uint8Bytes.slice(start, end)));
    //                     }
    //                 }
    //                 return parents;

    //             default:
    //                 console.warn(`Unhandled devInspect type: '${moveType}'. Returning as hex.`);
    //                 return bytesToHex(uint8Bytes);
    //         }
    //     };
    //     // --- End of Internal Helper ---


    //     // Now, decode each of the 6 return values using our helper
    //     return {
    //         versionId:  decodeValue(returnValues[0]),
    //         rootBlobId: decodeValue(returnValues[1]),
    //         parents:    decodeValue(returnValues[2]),
    //         author:     decodeValue(returnValues[3]),
    //         timestamp:  decodeValue(returnValues[4]),
    //         message:    decodeValue(returnValues[5]),
    //     };
    // }
}

function bytesToHex(bytes: Uint8Array): string {
    return '0x' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

// These are low-level helpers to read specific data types from a BcsReader instance.

/** Reads 32 bytes and converts them to a 0x-prefixed hex string (for addresses/IDs). */
function readAddress(reader: BcsReader): string {
    // Replaced Node.js Buffer with a browser-compatible equivalent.
    const bytes = reader.readBytes(32);
    return `0x${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** Reads a variable-length string (vector<u8>). */
function readString(reader: BcsReader): string {
    const length = reader.readULEB(); // First, read the ULEB-encoded length of the string
    const bytes = reader.readBytes(length); // Then, read that many bytes
    return new TextDecoder().decode(bytes);
}

/** Reads an 8-byte (64-bit) little-endian number. */
function readU64(reader: BcsReader): number {
    const bytes = reader.readBytes(8);
    const dataView = new DataView(bytes.buffer);
    return Number(dataView.getBigUint64(0, true)); // `true` for little-endian byte order
}

