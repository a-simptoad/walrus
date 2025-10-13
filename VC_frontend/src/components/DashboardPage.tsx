import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, ConnectButton } from '@mysten/dapp-kit';
import { VersionFSClient } from '../versionFSClient'; // Adjust path if needed
import { type RepositoryInfo as SuiRepositoryInfo } from '../../../versionfs/src/services/suiService'; // Adjust path if needed
import { formatDate } from '../utils/formatting'; // Adjust path if needed

// Define a UI-specific type for the repository, extending the core info
interface RepositoryInfo extends SuiRepositoryInfo {
    lastUpdated: string; // The UI might want to display a formatted date
}

interface DashboardPageProps {
    navigate: (path: string) => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ navigate }) => {
    const account = useCurrentAccount();
    const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
    
    const [versionFSClient, setVersionFSClient] = useState<VersionFSClient | null>(null);
    const [repositories, setRepositories] = useState<RepositoryInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    
    // State for the "Create Repository" modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newRepoName, setNewRepoName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Effect to initialize the VersionFSClient when the wallet is connected.
    useEffect(() => {
        if (account && signAndExecuteTransaction) {
            // Create the client and pass the wallet's signing function and address.
            const client = new VersionFSClient(signAndExecuteTransaction, account.address);
            setVersionFSClient(client);
        }
    }, [account, signAndExecuteTransaction]);

    // Effect to fetch repositories once the client is ready.
    useEffect(() => {
        const fetchRepos = async () => {
            if (!versionFSClient) return;
            
            setIsLoading(true);
            setError('');
            try {
                const suiService = versionFSClient.getSuiService();
                const userRepos = await suiService.getRepositoriesByOwner();
                
                // Map the core data to the UI-specific type
                const reposForUi: RepositoryInfo[] = userRepos.map(repo => ({
                    ...repo,
                    // Placeholder as the contract doesn't have a timestamp. In a real app,
                    // this might come from an off-chain indexer or be added to the contract.
                    lastUpdated: new Date().toISOString(), 
                }));

                setRepositories(reposForUi);
            } catch (e) {
                console.error("Failed to fetch repositories:", e);
                setError("Could not fetch your repositories. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchRepos();
    }, [versionFSClient]);
    
    // Handles the logic for creating a new repository from the modal.
    const handleCreateRepository = async () => {
        if (!versionFSClient || !newRepoName.trim()) return;
        
        setIsCreating(true);
        setError('');
        try {
            const newRepoId = await versionFSClient.init(newRepoName);
            // After creation, navigate directly to the new repository's page.
            navigate(`/repository/${newRepoId}`);
        } catch (e) {
            console.error("Failed to create repository:", e);
            setError("Creation failed. Please check the console and try again.");
        } finally {
            // Reset modal state regardless of success or failure
            setIsCreating(false);
            setIsModalOpen(false);
            setNewRepoName('');
        }
    };

    // If the wallet is not connected, show a connect button.
    if (!account) {
        return (
            <div className="page">
                <div className="container" style={{ textAlign: 'center' }}>
                    <h2>Welcome to VersionFS</h2>
                    <p>Connect your Sui wallet to manage your repositories.</p>
                    <ConnectButton />
                </div>
            </div>
        );
    }
    
    return (
        <div className="page">
            <div className="container">
                <h2>Dashboard</h2>
                <div className="dashboard-actions">
                    <button className="btn btn--primary" onClick={() => setIsModalOpen(true)}>
                        Create New Repository
                    </button>
                </div>
                <section>
                    <h3>Your Repositories</h3>
                    {isLoading ? <p>Loading repositories...</p> :
                     error ? <p className="error-message">{error}</p> :
                     repositories.length === 0 ? <p>You have no repositories yet. Create one to get started!</p> :
                    (
                        <div className="repositories-grid">
                            {repositories.map(repo => (
                                <div
                                    key={repo.id}
                                    className="card repo-card"
                                    onClick={() => navigate(`/repository/${repo.id}`)}
                                >
                                    <div className="card__body">
                                        <h4>{repo.name}</h4>
                                        <div className="repo-meta">
                                            <span>{repo.versionCount} commits</span>
                                            <span>{formatDate(repo.lastUpdated)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
            
            {/* Create Repository Modal */}
            {isModalOpen && (
                <div className="modal-backdrop">
                    <div className="modal">
                        <h3>Create a New Repository</h3>
                        <div className="form-group">
                            <label htmlFor="repoName">Repository Name</label>
                            <input
                                id="repoName"
                                type="text"
                                className="form-control"
                                value={newRepoName}
                                onChange={(e) => setNewRepoName(e.target.value)}
                                placeholder="e.g., my-awesome-project"
                                disabled={isCreating}
                            />
                        </div>
                        {error && <p className="error-message">{error}</p>}
                        <div className="modal-actions">
                            <button className="btn btn--secondary" onClick={() => setIsModalOpen(false)} disabled={isCreating}>
                                Cancel
                            </button>
                            <button className="btn btn--primary" onClick={handleCreateRepository} disabled={isCreating || !newRepoName.trim()}>
                                {isCreating ? 'Creating...' : 'Create Repository'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardPage;

