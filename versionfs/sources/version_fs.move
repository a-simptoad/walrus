// Copyright (c) 2024
// SPDX-License-Identifier: MIT

/// VersionFS - A decentralized, version-controlled file system on Sui
/// Uses Walrus for blob storage and implements Git-like DAG structure
module version_fs::version_fs {
    use std::string::{Self, String};
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::vec_map::{Self, VecMap};
    use sui::table::{Self, Table};
    use std::vector;

    // ==================== Error Codes ====================
    const ENotOwner: u64 = 1;
    const EParentNotFound: u64 = 2;
    const EVersionExists: u64 = 3;
    const EBranchExists: u64 = 4;
    const EBranchNotFound: u64 = 5;
    const EVersionNotFound: u64 = 6;

    // ==================== Structs ====================

    /// Represents a version-controlled repository
    public struct Repository has key, store {
        id: UID,
        name: String,
        owner: address,
        /// Maps branch_name -> version_id
        branches: VecMap<String, ID>,
        /// Stores all version nodes
        versions: Table<ID, VersionNode>,
        version_count: u64,
    }

    /// Represents a single commit/version in the DAG
    public struct VersionNode has store, drop, copy {
        /// Walrus blob ID for the root directory/file
        root_blob_id: String,
        /// Parent version IDs (empty for initial commit, multiple for merges)
        parents: vector<ID>,
        /// Author of this version
        author: address,
        /// Timestamp of creation
        timestamp: u64,
        /// Commit message
        message: String,
        /// Unique identifier for this version
        version_id: ID,
    }

    /// Capability object to prove ownership
    public struct RepoCap has key, store {
        id: UID,
        repo_id: ID,
    }

    // ==================== Events ====================

    public struct RepositoryCreated has copy, drop {
        repo_id: ID,
        owner: address,
        name: String,
    }

    public struct NewCommit has copy, drop {
        repo_id: ID,
        version_id: ID,
        root_blob_id: String,
        branch_name: String,
        author: address,
    }

    public struct BranchUpdated has copy, drop {
        repo_id: ID,
        branch_name: String,
        new_head: ID,
    }

    public struct BranchCreated has copy, drop {
        repo_id: ID,
        branch_name: String,
        version_id: ID,
    }

    // ==================== Public Functions ====================

    /// Create a new repository
    public entry fun create_repository(
        name: vector<u8>,
        ctx: &mut TxContext
    ) {
        let repo_uid = object::new(ctx);
        let repo_id = object::uid_to_inner(&repo_uid);
        
        let repository = Repository {
            id: repo_uid,
            name: string::utf8(name),
            owner: tx_context::sender(ctx),
            branches: vec_map::empty(),
            versions: table::new(ctx),
            version_count: 0,
        };

        // Create capability for the owner
        let cap = RepoCap {
            id: object::new(ctx),
            repo_id,
        };

        event::emit(RepositoryCreated {
            repo_id,
            owner: tx_context::sender(ctx),
            name: string::utf8(name),
        });

        transfer::share_object(repository);
        transfer::transfer(cap, tx_context::sender(ctx));
    }

    /// Create a new commit and update branch
    public entry fun commit(
        repo: &mut Repository,
        _cap: &RepoCap,
        branch_name: vector<u8>,
        root_blob_id: vector<u8>,
        parent_ids: vector<ID>,
        message: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Verify ownership
        assert!(repo.owner == tx_context::sender(ctx), ENotOwner);

        // Verify all parents exist
        let mut i = 0;
        let parent_len = vector::length(&parent_ids);
        while (i < parent_len) {
            let parent_id = *vector::borrow(&parent_ids, i);
            assert!(table::contains(&repo.versions, parent_id), EParentNotFound);
            i = i + 1;
        };

        // Create unique version ID
        let version_uid = object::new(ctx);
        let version_id = object::uid_to_inner(&version_uid);
        object::delete(version_uid);

        // Create version node
        let version_node = VersionNode {
            root_blob_id: string::utf8(root_blob_id),
            parents: parent_ids,
            author: tx_context::sender(ctx),
            timestamp: tx_context::epoch(ctx),
            message: string::utf8(message),
            version_id,
        };

        // Store version
        table::add(&mut repo.versions, version_id, version_node);
        repo.version_count = repo.version_count + 1;

        // Update or create branch
        let branch_name_str = string::utf8(branch_name);
        if (vec_map::contains(&repo.branches, &branch_name_str)) {
            let (_key, _old_value) = vec_map::remove(&mut repo.branches, &branch_name_str);
        };
        vec_map::insert(&mut repo.branches, branch_name_str, version_id);

        event::emit(NewCommit {
            repo_id: object::uid_to_inner(&repo.id),
            version_id,
            root_blob_id: string::utf8(root_blob_id),
            branch_name: string::utf8(branch_name),
            author: tx_context::sender(ctx),
        });

        event::emit(BranchUpdated {
            repo_id: object::uid_to_inner(&repo.id),
            branch_name: string::utf8(branch_name),
            new_head: version_id,
        });
    }

    /// Create a new branch pointing to an existing version
    public entry fun create_branch(
        repo: &mut Repository,
        _cap: &RepoCap,
        new_branch_name: vector<u8>,
        version_id: ID,
        ctx: &mut TxContext
    ) {
        // Verify ownership
        assert!(repo.owner == tx_context::sender(ctx), ENotOwner);

        // Verify version exists
        assert!(table::contains(&repo.versions, version_id), EVersionNotFound);

        // Verify branch doesn't exist
        let branch_name_str = string::utf8(new_branch_name);
        assert!(!vec_map::contains(&repo.branches, &branch_name_str), EBranchExists);

        // Create branch
        vec_map::insert(&mut repo.branches, branch_name_str, version_id);

        event::emit(BranchCreated {
            repo_id: object::uid_to_inner(&repo.id),
            branch_name: string::utf8(new_branch_name),
            version_id,
        });

        event::emit(BranchUpdated {
            repo_id: object::uid_to_inner(&repo.id),
            branch_name: string::utf8(new_branch_name),
            new_head: version_id,
        });
    }

    // ==================== View Functions ====================

    /// Get the head of a branch
    public fun get_branch_head(
        repo: &Repository,
        branch_name: vector<u8>
    ): ID {
        let branch_name_str = string::utf8(branch_name);
        assert!(vec_map::contains(&repo.branches, &branch_name_str), EBranchNotFound);
        *vec_map::get(&repo.branches, &branch_name_str)
    }

    /// Get version details
    public fun get_version(
        repo: &Repository,
        version_id: ID
    ): &VersionNode {
        assert!(table::contains(&repo.versions, version_id), EVersionNotFound);
        table::borrow(&repo.versions, version_id)
    }

    /// Get repository name
    public fun get_repo_name(repo: &Repository): String {
        repo.name
    }

    /// Get repository owner
    public fun get_repo_owner(repo: &Repository): address {
        repo.owner
    }

    /// Get version count
    public fun get_version_count(repo: &Repository): u64 {
        repo.version_count
    }

    /// Get version node details
    public fun get_version_blob_id(version: &VersionNode): String {
        version.root_blob_id
    }

    public fun get_version_author(version: &VersionNode): address {
        version.author
    }

    public fun get_version_timestamp(version: &VersionNode): u64 {
        version.timestamp
    }

    public fun get_version_message(version: &VersionNode): String {
        version.message
    }

    public fun get_version_parents(version: &VersionNode): vector<ID> {
        version.parents
    }
}