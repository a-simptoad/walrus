import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, ConnectButton } from '@mysten/dapp-kit';
import { VersionFSClient, type CommitMetadata } from '../versionFSClient'; // Adjust path
import { type RepositoryInfo } from '../../../versionfs/src/services/suiService'; // Adjust path
import { WalrusService, type FileMetadata } from '../../../versionfs/src/services/walrusService'; // Adjust path
import { formatDate, getFileIcon } from '../utils/formatting'; // Adjust path

interface RepositoryPageProps {
    repositoryId?: string;
    navigate: (path: string) => void;
}

const RepositoryPage: React.FC<RepositoryPageProps> = ({ repositoryId, navigate }) => {
    const account = useCurrentAccount();
    const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

    // State for services and core data
    const [versionFSClient, setVersionFSClient] = useState<VersionFSClient | null>(null);
    const [walrusService] = useState(new WalrusService()); // Walrus doesn't need wallet details
    const [repository, setRepository] = useState<RepositoryInfo | null>(null);
    const [versions, setVersions] = useState<CommitMetadata[]>([]);
    const [files, setFiles] = useState<FileMetadata[]>([]);
    
    // State for UI control
    const [selectedVersionId, setSelectedVersionId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Initialize the VersionFSClient once the wallet is connected.
    useEffect(() => {
        if (account && signAndExecuteTransaction && repositoryId) {
            const client = new VersionFSClient(signAndExecuteTransaction, account.address);
            // TODO: In a real app, the OwnerCap ID must be fetched or stored, not hardcoded.
            // This is a placeholder and will need to be replaced with a real cap ID for commits to work.
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
                console.log(`Fetched ${commits}`);

                setVersions(commits);
                console.log('Commit history:', commits);  

                if (commits.length > 0) {
                    console.log('Repository info:', repoInfo);

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
            if (!selectedVersion || !walrusService) return;

            setIsLoadingFiles(true);
            try {
                const directoryTree = await walrusService.downloadDirectory(selectedVersion.rootBlobId);
                setFiles(Object.values(directoryTree));
            } catch (e: any) {
                console.error(`Failed to fetch files for version ${selectedVersionId}:`, e);
                // Set files to empty array on error to clear previous state
                setFiles([]); 
            } finally {
                setIsLoadingFiles(false);
            }
        };
        fetchFiles();
    }, [selectedVersionId, versions, walrusService]);

    // Check for a success message from a previous navigation (e.g., after a commit).
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
    if (error) return <div className="page"><div className="container"><p className="error-message">{error}</p></div></div>;
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
                        <button className="btn btn--outline">Download as ZIP</button>
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

                <div className="file-list">
                    <div className="file-list-header">Files & Directories</div>
                    {isLoadingFiles ? <div className="file-item"><p>Loading files...</p></div> :
                     files.length === 0 ? <div className="file-item"><p>This commit is empty.</p></div> :
                     files.map((file) => (
                        <div key={file.path} className="file-item">
                            <div className="file-icon">{getFileIcon(file.name, file.type)}</div>
                            <div className="file-name">{file.path}</div>
                            <div className="file-size">{file.size ? `${(file.size / 1024).toFixed(2)} KB` : '-'}</div>
                            {/* <div className="file-date">{formatDate(new Date())}</div> */}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RepositoryPage;

