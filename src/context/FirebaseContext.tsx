import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  OperationType,
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
} from "../lib/firebase";
import { ChatRolePreset, GroundingSource } from "../types";

export interface SavedVerificationItem {
  id: string;
  certificateId: string;
  result: "AUTHENTIC" | "TAMPERED" | "REVOKED" | "NOT_FOUND";
  legitimacyLabel: string;
  note?: string;
}

export interface PersistedChatSession {
  id: string;
  title: string;
  rolePreset: ChatRolePreset;
  useSearchGrounding: boolean;
}

export interface PersistedChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  model: string;
  groundingTitles?: string[];
}

interface FirebaseContextValue {
  firebaseUser: User | null;
  authReady: boolean;
  idToken: string | null;
  signingIn: boolean;
  savedVerifications: SavedVerificationItem[];
  chatSessions: PersistedChatSession[];
  signInWithGoogle: () => Promise<User | null>;
  signOutGoogle: () => Promise<void>;
  refreshIdToken: () => Promise<string | null>;
  saveVerification: (input: {
    certificateId: string;
    result: "AUTHENTIC" | "TAMPERED" | "REVOKED" | "NOT_FOUND";
    legitimacyLabel: string;
    note?: string;
  }) => Promise<void>;
  removeSavedVerification: (docId: string) => Promise<void>;
  persistChatTurn: (input: {
    sessionId: string;
    title: string;
    rolePreset: ChatRolePreset;
    useSearchGrounding: boolean;
    userMessage: string;
    assistantReply: string;
    model: string;
    sources?: GroundingSource[];
  }) => Promise<void>;
  loadChatSessionMessages: (
    sessionId: string
  ) => Promise<PersistedChatMessage[]>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

function sanitizeFirestoreId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
  return cleaned || `id_${Date.now()}`;
}

export function FirebaseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [savedVerifications, setSavedVerifications] = useState<
    SavedVerificationItem[]
  >([]);
  const [chatSessions, setChatSessions] = useState<PersistedChatSession[]>([]);

  const syncUserProfile = useCallback(async (user: User, token: string) => {
    const uid = sanitizeFirestoreId(user.uid);
    const displayName = (user.displayName || user.email?.split("@")[0] || "CertiChain User").slice(0, 120);
    const photoURL = (user.photoURL || "").slice(0, 500);
    const email = (user.email || "").slice(0, 160);

    const publicRef = doc(db, "users_public", uid);
    const privateRef = doc(db, "users_private", uid);

    try {
      const publicSnap = await getDoc(publicRef);
      if (!publicSnap.exists()) {
        await setDoc(publicRef, {
          uid,
          displayName,
          ...(photoURL ? { photoURL } : {}),
          role: "user",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(publicRef, {
          displayName,
          ...(photoURL ? { photoURL } : {}),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users_public/${uid}`);
    }

    if (email) {
      try {
        const privateSnap = await getDoc(privateRef);
        if (!privateSnap.exists()) {
          await setDoc(privateRef, {
            uid,
            email,
            emailVerified: Boolean(user.emailVerified),
            preferredRolePreset: "general",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(privateRef, {
            email,
            emailVerified: Boolean(user.emailVerified),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users_private/${uid}`);
      }
    }

    // Sync signed-in user session to backend Cloud SQL via Firebase ID token
    await fetch("/api/auth/firebase-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          setIdToken(token);
          if (user.emailVerified) {
            void syncUserProfile(user, token).catch((err) => {
              console.warn("User profile sync warning:", err);
            });
          }
        } catch {
          setIdToken(null);
        }
      } else {
        setIdToken(null);
        setSavedVerifications([]);
        setChatSessions([]);
      }
      setAuthReady(true);
    });

    return () => unsub();
  }, [syncUserProfile]);

  useEffect(() => {
    if (!authReady || !firebaseUser) {
      return;
    }

    const uid = sanitizeFirestoreId(firebaseUser.uid);
    const savedPath = `users/${uid}/saved_verifications`;
    const savedQuery = query(
      collection(db, savedPath),
      where("ownerUid", "==", uid),
      orderBy("updatedAt", "desc"),
      limit(25)
    );

    const unsubSaved = onSnapshot(
      savedQuery,
      (snap) => {
        const items: SavedVerificationItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            certificateId: String(data.certificateId || ""),
            result: data.result || "NOT_FOUND",
            legitimacyLabel: String(data.legitimacyLabel || ""),
            note: typeof data.note === "string" ? data.note : undefined,
          };
        });
        setSavedVerifications(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, savedPath);
      }
    );

    const sessionsPath = `users/${uid}/chat_sessions`;
    const sessionsQuery = query(
      collection(db, sessionsPath),
      where("ownerUid", "==", uid),
      orderBy("updatedAt", "desc"),
      limit(15)
    );

    const unsubSessions = onSnapshot(
      sessionsQuery,
      (snap) => {
        const items: PersistedChatSession[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: String(data.title || "Verification Chat"),
            rolePreset: (data.rolePreset as ChatRolePreset) || "general",
            useSearchGrounding: Boolean(data.useSearchGrounding),
          };
        });
        setChatSessions(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, sessionsPath);
      }
    );

    return () => {
      unsubSaved();
      unsubSessions();
    };
  }, [authReady, firebaseUser]);

  const signInWithGoogle = useCallback(async () => {
    setSigningIn(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const token = await cred.user.getIdToken();
      setIdToken(token);
      return cred.user;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOutGoogle = useCallback(async () => {
    await signOut(auth);
    setIdToken(null);
  }, []);

  const refreshIdToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    const token = await auth.currentUser.getIdToken();
    setIdToken(token);
    return token;
  }, []);

  const saveVerification = useCallback(
    async (input: {
      certificateId: string;
      result: "AUTHENTIC" | "TAMPERED" | "REVOKED" | "NOT_FOUND";
      legitimacyLabel: string;
      note?: string;
    }) => {
      if (!auth.currentUser) {
        throw new Error("Please sign in with Google to save verifications.");
      }
      const uid = sanitizeFirestoreId(auth.currentUser.uid);
      const docId = sanitizeFirestoreId(
        `${input.certificateId || "FILE"}_${Date.now()}`
      );
      const docPath = `users/${uid}/saved_verifications/${docId}`;
      const ref = doc(db, "users", uid, "saved_verifications", docId);
      try {
        await setDoc(ref, {
          ownerUid: uid,
          certificateId: (input.certificateId || "UNIDENTIFIED").slice(0, 64),
          result: input.result,
          legitimacyLabel: input.legitimacyLabel.slice(0, 160),
          ...(input.note ? { note: input.note.slice(0, 500) } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, docPath);
      }
    },
    []
  );

  const removeSavedVerification = useCallback(async (docId: string) => {
    if (!auth.currentUser) return;
    const uid = sanitizeFirestoreId(auth.currentUser.uid);
    const safeId = sanitizeFirestoreId(docId);
    const docPath = `users/${uid}/saved_verifications/${safeId}`;
    try {
      await deleteDoc(doc(db, "users", uid, "saved_verifications", safeId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, docPath);
    }
  }, []);

  const persistChatTurn = useCallback(
    async (input: {
      sessionId: string;
      title: string;
      rolePreset: ChatRolePreset;
      useSearchGrounding: boolean;
      userMessage: string;
      assistantReply: string;
      model: string;
      sources?: GroundingSource[];
    }) => {
      if (!auth.currentUser || !auth.currentUser.emailVerified) return;
      const uid = sanitizeFirestoreId(auth.currentUser.uid);
      const sessionId = sanitizeFirestoreId(input.sessionId);
      const sessionRef = doc(db, "users", uid, "chat_sessions", sessionId);
      const userMsgId = sanitizeFirestoreId(`u_${Date.now()}`);
      const modelMsgId = sanitizeFirestoreId(`m_${Date.now() + 1}`);
      const userMsgRef = doc(
        db,
        "users",
        uid,
        "chat_sessions",
        sessionId,
        "messages",
        userMsgId
      );
      const modelMsgRef = doc(
        db,
        "users",
        uid,
        "chat_sessions",
        sessionId,
        "messages",
        modelMsgId
      );

      const titles = (input.sources || [])
        .slice(0, 10)
        .map((s) => `${s.title.slice(0, 80)} (${s.uri.slice(0, 110)})`.slice(0, 200));

      try {
        const existingSnap = await getDoc(sessionRef);
        const batch = writeBatch(db);
        if (!existingSnap.exists()) {
          batch.set(sessionRef, {
            ownerUid: uid,
            title: input.title.slice(0, 120) || "CertiChain Assistant",
            rolePreset: input.rolePreset,
            useSearchGrounding: input.useSearchGrounding,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.update(sessionRef, {
            title: String(existingSnap.data().title || input.title).slice(0, 120),
            rolePreset: input.rolePreset,
            useSearchGrounding: input.useSearchGrounding,
            updatedAt: serverTimestamp(),
          });
        }

        batch.set(userMsgRef, {
          ownerUid: uid,
          sessionId,
          role: "user",
          content: input.userMessage.slice(0, 12000),
          model: input.model.slice(0, 80),
          createdAt: serverTimestamp(),
        });

        batch.set(modelMsgRef, {
          ownerUid: uid,
          sessionId,
          role: "model",
          content: input.assistantReply.slice(0, 12000),
          model: input.model.slice(0, 80),
          ...(titles.length > 0 ? { groundingTitles: titles } : {}),
          createdAt: serverTimestamp(),
        });

        await batch.commit();
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.WRITE,
          `users/${uid}/chat_sessions/${sessionId}`
        );
      }
    },
    []
  );

  const loadChatSessionMessages = useCallback(
    async (sessionId: string): Promise<PersistedChatMessage[]> => {
      if (!auth.currentUser) return [];
      const uid = sanitizeFirestoreId(auth.currentUser.uid);
      const safeSessionId = sanitizeFirestoreId(sessionId);
      const messagesPath = `users/${uid}/chat_sessions/${safeSessionId}/messages`;
      try {
        const q = query(
          collection(db, messagesPath),
          where("ownerUid", "==", uid),
          orderBy("createdAt", "asc"),
          limit(50)
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            role: data.role === "model" ? "model" : "user",
            content: String(data.content || ""),
            model: String(data.model || "gemini-4-hydrogen"),
            groundingTitles: Array.isArray(data.groundingTitles)
              ? data.groundingTitles
              : undefined,
          };
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, messagesPath);
      }
    },
    []
  );

  return (
    <FirebaseContext.Provider
      value={{
        firebaseUser,
        authReady,
        idToken,
        signingIn,
        savedVerifications,
        chatSessions,
        signInWithGoogle,
        signOutGoogle,
        refreshIdToken,
        saveVerification,
        removeSavedVerification,
        persistChatTurn,
        loadChatSessionMessages,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error("useFirebase must be used within a FirebaseProvider");
  }
  return ctx;
}
