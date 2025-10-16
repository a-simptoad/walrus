import React, { useState, useEffect, useMemo } from 'react';
import {
    ConnectButton,
    useCurrentAccount,
    useSignAndExecuteTransaction,
    useSuiClientQuery,
} from '@mysten/dapp-kit';
import { VersionFSClient } from '../versionFSClient';
import { getFileIcon } from '../utils/formatting';

// Extend input attributes to support directory uploads
declare module 'react' {
    interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
        webkitdirectory?: string;
        directory?: string;
    }
}

interface CommitPageProps {
    repositoryId?: string;
    navigate: (path: string) => void;
}

const CommitPage: React.FC<CommitPageProps> = ({ repositoryId, navigate }) => {
    const account = useCurrentAccount();
    const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

    const [vfsClient, setVfsClient] = useState<VersionFSClient | null>(null);
    const [commitMessage, setCommitMessage] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isCommitting, setIsCommitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    // Query 1: Fetch the repository's details to display its name.
    const { data: repoData, isPending: isRepoPending } = useSuiClientQuery('getObject',
        { id: repositoryId!, options: { showContent: true } },
        { enabled: !!repositoryId }
    );

    // Query 2: Fetch all of the user's capabilities to find the one for this repository.
    const { data: repoCapsData } = useSuiClientQuery('getOwnedObjects',
        {
            owner: account?.address!,
            filter: { StructType: `0xf52972b9a7ea5ec2a8582777bd852f80c6c3d550a28242e5ef44e25320663e2e::version_fs::RepoCap` },
            options: { showContent: true }
        },
        { enabled: !!account?.address }
    );

    // Memoized selector to find the specific capability ID for the current repository.
    const repoCapId = useMemo(() => {
        if (!repoCapsData?.data || !repositoryId) return undefined;
        const capObject = repoCapsData.data.find(cap => (cap.data?.content as any)?.fields.repo_id === repositoryId);
        return capObject?.data?.objectId;
    }, [repoCapsData, repositoryId]);

    // Initialize the VersionFSClient once the wallet is connected.
    useEffect(() => {
        if (account && signAndExecuteTransaction) {
            setVfsClient(new VersionFSClient(signAndExecuteTransaction, account.address));
        }
    }, [account, signAndExecuteTransaction]);

    const handleCommit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!vfsClient || !repositoryId || !repoCapId) {
            setError('Client not ready or repository capability not found. Ensure you have the correct permissions.');
            return;
        }
        if (!commitMessage.trim() || selectedFiles.length === 0) {
            setError('Please provide a commit message and select at least one file.');
            return;
        }

        setIsCommitting(true);
        setError(null);

        try {
            // Set the client's context to the current repository
            vfsClient.setRepoIds(repositoryId, repoCapId);

            const filesToCommit = await Promise.all(
                selectedFiles.map(async (file) => ({
                    path: (file as any).webkitRelativePath || file.name,
                    data: await readFileAsUint8Array(file)
                }))
            );

            await vfsClient.commit(filesToCommit, commitMessage, 'main');

            // Navigate back to the repository page with a success indicator
            navigate(`/repository/${repositoryId}?success=commit`);
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred during the commit process.');
        } finally {
            setIsCommitting(false);
        }
    };

    const readFileAsUint8Array = (file: File): Promise<Uint8Array> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result instanceof ArrayBuffer) {
                    resolve(new Uint8Array(event.target.result));
                } else {
                    reject(new Error('Failed to read file as ArrayBuffer.'));
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    };

    // --- UI Event Handlers ---
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => e.target.files && setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragOver(false); setSelectedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]); };
    const removeFile = (indexToRemove: number) => setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));

    if (!account) {
        return (
            <div className="page">
                <div className="container" style={{ textAlign: 'center' }}>
                    <h2>Connect Wallet</h2>
                    <p>Please connect your wallet to create a commit.</p>
                    <ConnectButton />
                </div>
            </div>
        );
    }

    if (isRepoPending || !repoData) {
        return <div className="page"><div className="container"><p>Loading repository details...</p></div></div>;
    }

    const repositoryName = (repoData.data?.content as any)?.fields.name || 'Repository';

    return (
        <div className="page">
            <div className="container">
                <h2>New Commit - {repositoryName}</h2>
                <form className="commit-form" onSubmit={handleCommit}>
                    <fieldset disabled={isCommitting}>
                        <div className="form-group">
                            <label className="form-label">Commit Message *</label>
                            <textarea className="form-control" value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} placeholder="Describe your changes..." rows={3} required />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Files & Directories</label>
                            <div className={`upload-area ${isDragOver ? 'upload-area--active' : ''}`} onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={handleDrop}>
                                <p>Drag & drop files or folders here</p>
                                <div className="upload-buttons">
                                    <button type="button" className="btn btn--secondary" onClick={() => document.getElementById('file-input')?.click()}>Select Files</button>
                                    <button type="button" className="btn btn--secondary" onClick={() => document.getElementById('directory-input')?.click()}>Select Directory</button>
                                </div>
                            </div>
                            <input id="file-input" type="file" className="file-input" multiple onChange={handleFileSelect} />
                            <input id="directory-input" type="file" className="file-input" webkitdirectory="" directory="" multiple onChange={handleFileSelect} />
                        </div>

                        {selectedFiles.length > 0 && (
                            <div className="selected-files">
                                <h4>Selected Files ({selectedFiles.length})</h4>
                                {selectedFiles.map((file, index) => {
                                    const filePath = (file as any).webkitRelativePath || file.name;
                                    return (
                                        <div key={index} className="selected-file">
                                            <span>{getFileIcon(file.name, file.type)} {filePath} ({(file.size / 1024).toFixed(1)} KB)</span>
                                            <button type="button" className="remove-file" onClick={() => removeFile(index)}>✕</button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {error && <div className="error-message">{error}</div>}

                        <div className="commit-actions">
                            <button type="button" className="btn btn--secondary" onClick={() => navigate(`/repository/${repositoryId}`)}>Cancel</button>
                            <button type="submit" className="btn btn--primary">{isCommitting ? 'Committing...' : 'Commit Changes'}</button>
                        </div>
                    </fieldset>
                </form>
            </div>
        </div>
    );
};

export default CommitPage;

