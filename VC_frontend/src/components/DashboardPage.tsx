import React, { useState, useEffect, useMemo } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, ConnectButton, useSuiClientQuery } from '@mysten/dapp-kit';
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
    
    // State for the "Create Repository" modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newRepoName, setNewRepoName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [creationError, setCreationError] = useState('');

    // --- STEP 1: Fetch the user's `RepoCap` objects. ---
    // These capabilities are owned by the user and grant access to the shared repositories.
    const { data: repoCapsData, isPending: isCapsPending, error: capsError, refetch } = useSuiClientQuery('getOwnedObjects', 
        {
            owner: account?.address!,
            filter: { StructType: `0xf52972b9a7ea5ec2a8582777bd852f80c6c3d550a28242e5ef44e25320663e2e::version_fs::RepoCap` },
            options: { showContent: true },
        },
        {
            enabled: !!account?.address,
        }
    );

    // --- STEP 2: Extract the Repository IDs from the `RepoCap` objects. ---
    // We use useMemo to ensure this array is only recalculated when the caps data changes.
    const repositoryIds = useMemo(() => {
        if (!repoCapsData?.data) return [];
        return repoCapsData.data
            .map(cap => (cap.data?.content as any)?.fields.repo_id)
            .filter(id => id); // Filter out any undefined IDs
    }, [repoCapsData]);

    // --- STEP 3: Fetch the actual `Repository` objects using the extracted IDs. ---
    // This query will only run once `repositoryIds` has items in it.
    const { data: repositoriesData, isPending: isReposPending, error: reposError } = useSuiClientQuery('multiGetObjects', 
        {
            ids: repositoryIds,
            options: { showContent: true },
        },
        {
            enabled: repositoryIds.length > 0,
        }
    );

    // Effect to initialize the VersionFSClient when the wallet is connected.
    useEffect(() => {
        if (account && signAndExecuteTransaction) {
            const client = new VersionFSClient(signAndExecuteTransaction, account.address);
            setVersionFSClient(client);
        }
    }, [account, signAndExecuteTransaction]);
    
    // Handles the logic for creating a new repository from the modal.
    const handleCreateRepository = async () => {
        if (!versionFSClient || !newRepoName.trim()) return;
        
        setIsCreating(true);
        setCreationError('');
        try {
            const newRepoId = await versionFSClient.init(newRepoName);
            // After creation, refetch the capabilities list, which will trigger the repositories fetch.
            await refetch();
            navigate(`/repository/${newRepoId}`);
        } catch (e: any) {
            console.error("Failed to create repository:", e);
            setCreationError(e.message || "Creation failed. Please try again.");
        } finally {
            setIsCreating(false);
            if (!creationError) { // Only close modal on success
                setIsModalOpen(false);
                setNewRepoName('');
            }
        }
    };

    // If the wallet is not connected, show a connect button.
    if (!account) {
        return (
            <div className="page"><div className="container" style={{ textAlign: 'center' }}>
                <h2>Welcome to VersionFS</h2>
                <p>Connect your Sui wallet to manage your repositories.</p>
                <ConnectButton />
            </div></div>
        );
    }

    // Combine loading and error states from both queries
    const isLoading = isCapsPending || isReposPending;
    const queryError = capsError || reposError;

    // Now, we map the final repository data to what our UI expects.
    const repositories: RepositoryInfo[] = (repositoriesData || []).map(repo => {
        const fields = (repo.data?.content as any)?.fields;
        return {
            id: fields?.id.id,
            name: fields?.name,
            owner: fields?.owner,
            versionCount: parseInt(fields?.version_count, 10),
            lastUpdated: new Date().toISOString(), // Placeholder
        };
    }).filter(repo => repo.id); // Filter out any malformed objects
    
    return (
        <div className="page" >
            <div className="container">
                <h2>Dashboard</h2>
                <br />
                <div className="dashboard-actions">
                    <button className="btn btn--primary" onClick={() => setIsModalOpen(true)}>
                        Create New Repository
                    </button>
                </div>
                {/* Create Repository Modal */}
                {isModalOpen && (
                    <div className="modal-backdrop" style={{ lineHeight: '3'}}>
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
                            {creationError && <p className="error-message">{creationError}</p>}
                            <div className="modal-actions" style={{display: 'flex', gap: '10px'}}>
                                <button className="btn btn--secondary" onClick={() => setIsModalOpen(false)} disabled={isCreating}>
                                    Cancel
                                </button>
                                <button className="btn btn--primary" onClick={handleCreateRepository} disabled={isCreating || !newRepoName.trim()}>
                                    {isCreating ? 'Creating...' : 'Create Repository'}
                                </button>
                            </div>
                        </div>
                        <br />
                    </div>
                )}
                <section>
                    <h3>Your Repositories</h3>
                    <br />
                    {isLoading ? <p>Loading repositories...</p> :
                     queryError ? <p className="error-message">Error: {queryError.message}</p> :
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
        </div>
    );
};

export default DashboardPage;

