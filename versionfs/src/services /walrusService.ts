/**
 * Walrus Storage Service
 * Handles file upload and download to/from Walrus decentralized storage
 */

const WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";
const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";

export interface WalrusUploadResponse {
  newlyCreated?: {
    blobObject: {
      id: string;
      registeredEpoch: number;
      blobId: string;
      size: number;
      encodingType: string;
      certifiedEpoch: number | null;
      storage: any;
      deletable: boolean;
    };
    resourceOperation: any;
    cost: number;
  };
  alreadyCertified?: {
    blobId: string;
    event: any;
    endEpoch: number;
  };
}

export interface FileMetadata {
  name: string;
  path: string;
  size: number;
  type: string;
  blobId?: string;
}

export class WalrusService {
  private publisherUrl: string;
  private aggregatorUrl: string;

  constructor(
    publisherUrl: string = WALRUS_PUBLISHER,
    aggregatorUrl: string = WALRUS_AGGREGATOR
  ) {
    this.publisherUrl = publisherUrl;
    this.aggregatorUrl = aggregatorUrl;
  }

  /**
   * Upload a file to Walrus
   * @param data - File data (Uint8Array, Blob, or string)
   * @param epochs - Number of epochs to store (default: 3)
   * @returns Blob ID
   */
  async uploadFile(
    data: Uint8Array | Blob | string,
    epochs: number = 3
  ): Promise<string> {
    try {
      let blob: Blob;

      if (typeof data === "string") {
        blob = new Blob([new TextEncoder().encode(data)]);
      } else if (data instanceof Uint8Array) {
        blob = new Blob([data]);
      } else {
        blob = data;
      }

      console.log(`📤 Uploading ${blob.size} bytes to Walrus...`);

      const response = await fetch(
        `${this.publisherUrl}/v1/blobs?epochs=${epochs}`,
        {
          method: "PUT",
          body: blob,
          headers: {
            "Content-Type": "application/octet-stream",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Upload failed: ${response.status} - ${errorText}`
        );
      }

      const result: WalrusUploadResponse = await response.json();

      let blobId: string;
      if (result.newlyCreated) {
        blobId = result.newlyCreated.blobObject.blobId;
        console.log("✅ File uploaded successfully!");
        console.log(`📦 Blob ID: ${blobId}`);
        console.log(`💰 Cost: ${result.newlyCreated.cost} MIST`);
      } else if (result.alreadyCertified) {
        blobId = result.alreadyCertified.blobId;
        console.log("✅ File already exists on Walrus!");
        console.log(`📦 Blob ID: ${blobId}`);
      } else {
        throw new Error("Unexpected response format");
      }

      return blobId;
    } catch (error) {
      console.error("❌ Upload error:", error);
      throw error;
    }
  }

  /**
   * Download a file from Walrus
   * @param blobId - The blob ID to download
   * @returns File data as Uint8Array
   */
  async downloadFile(blobId: string): Promise<Uint8Array> {
    try {
      console.log(`📥 Downloading blob: ${blobId}`);

      const response = await fetch(
        `${this.aggregatorUrl}/v1/blobs/${blobId}`
      );

      if (!response.ok) {
        throw new Error(
          `Download failed: ${response.status} - ${response.statusText}`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      console.log(`✅ Downloaded ${data.length} bytes`);
      return data;
    } catch (error) {
      console.error("❌ Download error:", error);
      throw error;
    }
  }

  /**
   * Download a file and save it
   * @param blobId - The blob ID to download
   * @param filename - Output filename
   */
  async downloadAndSave(blobId: string, filename: string): Promise<void> {
    try {
      const data = await this.downloadFile(blobId);
      
      // In Node.js environment
      if (typeof window === 'undefined') {
        const fs = await import('fs');
        fs.writeFileSync(filename, data);
        console.log(`💾 Saved to: ${filename}`);
      } else {
        // In browser environment
        const blob = new Blob([data]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        console.log(`💾 Downloaded: ${filename}`);
      }
    } catch (error) {
      console.error("❌ Download and save error:", error);
      throw error;
    }
  }

  /**
   * Upload a directory structure as JSON
   * @param directory - Directory structure
   * @param epochs - Number of epochs to store
   * @returns Blob ID
   */
  async uploadDirectory(
    directory: Record<string, FileMetadata>,
    epochs: number = 3
  ): Promise<string> {
    const jsonData = JSON.stringify(directory, null, 2);
    return this.uploadFile(jsonData, epochs);
  }

  /**
   * Download and parse directory structure
   * @param blobId - The blob ID of the directory
   * @returns Directory structure
   */
  async downloadDirectory(
    blobId: string
  ): Promise<Record<string, FileMetadata>> {
    const data = await this.downloadFile(blobId);
    const jsonData = new TextDecoder().decode(data);
    return JSON.parse(jsonData);
  }

  /**
   * Check if a blob exists on Walrus
   * @param blobId - The blob ID to check
   * @returns true if exists, false otherwise
   */
  async blobExists(blobId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.aggregatorUrl}/v1/blobs/${blobId}`,
        { method: "HEAD" }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Upload multiple files and return their blob IDs
   * @param files - Array of file data
   * @param epochs - Number of epochs to store
   * @returns Array of blob IDs
   */
  async uploadMultipleFiles(
    files: Array<{ name: string; data: Uint8Array | Blob | string }>,
    epochs: number = 3
  ): Promise<Array<{ name: string; blobId: string }>> {
    const results: Array<{ name: string; blobId: string }> = [];

    for (const file of files) {
      console.log(`\n📁 Processing: ${file.name}`);
      const blobId = await this.uploadFile(file.data, epochs);
      results.push({ name: file.name, blobId });
    }

    return results;
  }
}

// Export singleton instance
export const walrusService = new WalrusService();

// Example usage functions
export async function exampleUpload() {
  const service = new WalrusService();
  
  // Upload a simple text file
  const text = "Hello from VersionFS!";
  const blobId = await service.uploadFile(text);
  console.log("Blob ID:", blobId);
  
  return blobId;
}

export async function exampleDownload(blobId: string) {
  const service = new WalrusService();
  
  // Download and decode
  const data = await service.downloadFile(blobId);
  const text = new TextDecoder().decode(data);
  console.log("Content:", text);
  
  return text;
}