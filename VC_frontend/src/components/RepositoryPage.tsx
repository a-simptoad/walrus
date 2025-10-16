import React, { useState, useEffect } from 'react';
import {
    ConnectButton,
    useCurrentAccount,
    useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import { VersionFSClient, type CommitMetadata } from '../versionFSClient'; // Adjust path
import { type RepositoryInfo } from '../../../versionfs/src/services/suiService'; // Adjust path
import { WalrusService, type FileMetadata } from '../../../versionfs/src/services/walrusService'; // Adjust path
import { getFileIcon, formatDate } from '../utils/formatting'; // Adjust path
import JSZip from 'jszip'; // Import JSZip for creating the archive

interface RepositoryPageProps {
    repositoryId?: string;
    navigate: (path: string) => void;
}

const RepositoryPage: React.FC<RepositoryPageProps> = ({ repositoryId, navigate }) => {
    const account = useCurrentAccount();
    const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

    // State for services and core data
    const [versionFSClient, setVersionFSClient] = useState<VersionFSClient | null>(null);
    const [walrusService] = useState(new WalrusService());
    const [repository, setRepository] = useState<RepositoryInfo | null>(null);
    const [versions, setVersions] = useState<CommitMetadata[]>([]);
    const [files, setFiles] = useState<FileMetadata[]>([]);

    // State for UI control
    const [selectedVersionId, setSelectedVersionId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false); // New state for download button
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Initialize the VersionFSClient once the wallet is connected.
    useEffect(() => {
        if (account && signAndExecuteTransaction && repositoryId) {
            const client = new VersionFSClient(signAndExecuteTransaction, account.address);
            // TODO: The OwnerCap ID must be fetched, not hardcoded.
            client.setRepoIds(repositoryId, 'YOUR_OWNER_CAP_ID_HERE');
            setVersionFSClient(client);
        }
    }, [account, signAndExecuteTransaction, repositoryId]);

    // Fetch the main repository data and commit history.
    useEffect(() => {
        const fetchRepoData = async () => {
            if (!versionFSClient || !repositoryId) return;

            setIsLoading(true);
            setError('');
            try {
                const suiService = versionFSClient.getSuiService();
                const repoInfo = await suiService.getRepository(repositoryId);
                setRepository(repoInfo);

                const commits = await versionFSClient.log('main');
                setVersions(commits);

                if (commits.length > 0) {
                    setSelectedVersionId(commits[0].versionId);
                }
            } catch (e: any) {
                console.error('Failed to fetch repository data:', e);
                setError(`Failed to load repository: ${e.message}`);
            } finally {
                setIsLoading(false);
            }
        };
        fetchRepoData();
    }, [versionFSClient, repositoryId]);

    // Fetch the file list for the currently selected version.
    useEffect(() => {
        const fetchFiles = async () => {
            const selectedVersion = versions.find(v => v.versionId === selectedVersionId);
            if (!selectedVersion?.rootBlobId || !walrusService) {
                setFiles([]);
                return;
            }

            setIsLoadingFiles(true);
            try {
                const directoryTree = await walrusService.downloadDirectory(selectedVersion.rootBlobId);
                setFiles(Object.values(directoryTree));
            } catch (e: any) {
                console.error(`Failed to fetch files for version ${selectedVersionId}:`, e);
                setFiles([]);
            } finally {
                setIsLoadingFiles(false);
            }
        };
        fetchFiles();
    }, [selectedVersionId, versions, walrusService]);

    // Check for a success message from a previous navigation.
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
        if (urlParams.get('success') === 'commit') {
            setSuccessMessage('Commit created successfully!');
            const timer = setTimeout(() => {
                setSuccessMessage('');
                navigate(`/repository/${repositoryId}`); // Clean up URL
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [repositoryId, navigate]);

    // --- NEW: Download as ZIP functionality ---
    const handleDownload = async () => {
        const selectedVersion = versions.find(v => v.versionId === selectedVersionId);
        if (!selectedVersion || !repository?.name) {
            setError('Cannot download: No version selected or repository name is missing.');
            return;
        }

        setIsDownloading(true);
        setError('');
        try {
            // 1. Get the list of all files for the commit
            const directoryTree = await walrusService.downloadDirectory(selectedVersion.rootBlobId);
            const fileMetadatas = Object.values(directoryTree);

            if (fileMetadatas.length === 0) {
                // Use a less intrusive notification than alert
                setError('This commit has no files to download.');
                setTimeout(() => setError(''), 3000);
                return;
            }

            // 2. Download the content of all files in parallel
            const fileContents = await Promise.all(
                fileMetadatas.map(file => {
                    if (file.blobId) {
                        return walrusService.downloadFile(file.blobId);
                    }
                    return Promise.resolve(new Uint8Array()); // Return empty content if blobId is missing
                })
            );

            // 3. Create a new ZIP instance
            const zip = new JSZip();

            // 4. Add each downloaded file to the ZIP archive, preserving its path
            fileMetadatas.forEach((file, index) => {
                zip.file(file.path, fileContents[index]);
            });

            // 5. Generate the ZIP blob asynchronously
            const zipBlob = await zip.generateAsync({ type: 'blob' });

            // 6. Create a temporary link and trigger the browser download
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = `${repository.name}-${selectedVersionId.slice(2, 10)}.zip`;
            document.body.appendChild(link);
            link.click();

            // 7. Clean up the temporary link and URL object
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

        } catch (e: any) {
            console.error('Download failed:', e);
            setError(`Download failed: ${e.message}`);
        } finally {
            setIsDownloading(false);
        }
    };

    if (!account) {
        return (
            <div className="page"><div className="container" style={{ textAlign: 'center' }}>
                <h2>Connect your Sui Wallet</h2>
                <p>You need to connect your wallet to view repository details.</p>
                <ConnectButton />
            </div></div>
        );
    }

    if (isLoading) return <div className="page"><div className="container"><p>Loading repository...</p></div></div>;
    if (error && !repository) return <div className="page"><div className="container"><p className="error-message">{error}</p></div></div>;
    if (!repository) return <div className="page"><div className="container"><h2>Repository not found</h2></div></div>;

    return (
        <div className="page">
            <div className="container">
                {successMessage && <div className="success-message">{successMessage}</div>}

                <div className="repository-header">
                    <div>
                        <h2>{repository.name}</h2>
                        <p>A decentralized repository on the Sui network.</p>
                    </div>
                    <div className="repository-actions">
                        <button className="btn btn--outline" onClick={handleDownload} disabled={isDownloading}>
                            {isDownloading ? 'Zipping...' : 'Download as ZIP'}
                        </button>
                        <button className="btn btn--primary" onClick={() => navigate(`/commit/${repository.id}`)}>New Commit</button>
                    </div>
                </div>

                <div className="version-selector">
                    <label className="form-label">Version:</label>
                    <select
                        className="form-control"
                        value={selectedVersionId}
                        onChange={(e) => setSelectedVersionId(e.target.value)}
                        style={{ maxWidth: '400px' }}
                    >
                        {versions.length === 0 && <option>No commits found</option>}
                        {versions.map(version => (
                            <option key={version.versionId} value={version.versionId}>
                                {version.message} ({version.versionId.slice(0, 10)}...)
                            </option>
                        ))}
                    </select>
                </div>
                
                {error && <p className="error-message" style={{marginTop: '1rem'}}>{error}</p>}

                <div className="file-list">
                    <div className="file-list-header">Files & Directories</div>
                    {isLoadingFiles ? <div className="file-item"><p>Loading files...</p></div> :
                     files.length === 0 ? <div className="file-item"><p>This commit is empty.</p></div> :
                     files.map((file) => (
                        <div key={file.path} className="file-item">
                            <div className="file-icon">{getFileIcon(file.name, file.type)}</div>
                            <div className="file-name">{file.path}</div>
                            <div className="file-size">{file.size ? `${(file.size / 1024).toFixed(2)} KB` : '-'}</div>
                            <div className="file-date">{/* Placeholder for file date */}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RepositoryPage;

