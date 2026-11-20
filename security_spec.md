# CertiChain Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Catch-All**: All unspecified Firestore paths must deny read and write access (`match /{document=**} { allow read, write: if false; }`).
2. **Verified Identity Required for Writes**: Every user mutation requires `request.auth != null && request.auth.token.email_verified == true`.
3. **PII Isolation**: Email addresses (`users_private/{userId}`) are strictly isolated from public profile metadata (`users_public/{userId}`) and readable only by the owning UID or a verified administrator.
4. **Role Escalation Prevention**: Users creating `/users_public/{userId}` can only set `role == 'user'` unless they already satisfy `isAdmin()`; users cannot self-promote `role` on update.
5. **Master Gate & Atomicity on Subcollections**: `/users/{userId}/chat_sessions/{sessionId}/messages/{messageId}` requires the parent `chat_sessions/{sessionId}` document to exist (or be updated in the same batch via `existsAfter`) and belong to `request.auth.uid`.
6. **Immutable Ownership & Timestamps**: `ownerUid`, `uid`, and `createdAt` cannot be modified after creation, and `createdAt`/`updatedAt` must equal `request.time`.

## 2. "Dirty Dozen" Adversarial Test Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read of `/users_private/userA`.
2. Unverified email user attempting to create `/users_public/userA`.
3. User A attempting to read `/users_private/userB` (PII blanket read attack).
4. User A attempting to create `/users_public/userA` with `role: "admin"` (Self-assigned role escalation).
5. User A updating `/users_public/userA` to inject ghost field `isVerified: true` (Shadow update attack).
6. User A updating `/users/userA/saved_verifications/v1` with `ownerUid: "userB"` (Ownership spoofing).
7. User A creating `/users/userA/saved_verifications/v1` with forged `createdAt` timestamp not equal to `request.time`.
8. User A creating `/users/userA/chat_sessions/bad..id` with invalid path characters (`isValidId` guard).
9. User A creating `/users/userA/chat_sessions/s1/messages/m1` when parent session `s1` does not exist (Orphaned subcollection write).
10. User A creating `/users/userA/chat_sessions/s1/messages/m1` with `groundingTitles` array of 15 items (> max 10 limit).
11. User A attempting `list` on `/users/userB/saved_verifications` without owning `userB`.
12. User A writing `content` of 20,000 characters (> maxLength 12000) into `messages`.
