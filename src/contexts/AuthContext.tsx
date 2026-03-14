import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { db as localDb } from '../db/db';

interface AuthContextType {
    user: User | null;
    userId: string | null;
    membershipRank: string | null;
    loading: boolean;
    hasAccess: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userId: null,
    membershipRank: null,
    loading: true,
    hasAccess: false
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [membershipRank, setMembershipRank] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            // Start loading state immediately to cover the async Firestore fetch delay
            setLoading(true);
            setUser(currentUser);

            if (currentUser) {
                console.log("🔥 User authenticated with UID:", currentUser.uid);
                try {
                    // NOAH community profile data path
                    const docPath = `artifacts/default-app-id/users/${currentUser.uid}/profile/data`;
                    console.log("🔥 Fetching Firestore doc at path:", docPath);
                    const docRef = doc(db, 'artifacts', 'default-app-id', 'users', currentUser.uid, 'profile', 'data');
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        console.log("🔥 Firestore doc exists! Raw data:", data);
                        setMembershipRank(data.membershipRank || null);
                        setUserId(data.userId || null);
                        console.log("🔥 Extracted membershipRank:", data.membershipRank, "userId:", data.userId);

                        // Sync API keys to local DB if available
                        if (data.geminiApiKey !== undefined || data.aiModel !== undefined || data.useFirebaseSync !== undefined) {
                            try {
                                const localSettings = await localDb.settings.get(1);
                                if (localSettings) {
                                    await localDb.settings.update(1, {
                                        geminiApiKey: data.geminiApiKey !== undefined ? data.geminiApiKey : localSettings.geminiApiKey,
                                        aiModel: data.aiModel !== undefined ? data.aiModel : localSettings.aiModel,
                                        useFirebaseSync: data.useFirebaseSync !== undefined ? data.useFirebaseSync : localSettings.useFirebaseSync
                                    });
                                } else {
                                    await localDb.settings.add({
                                        id: 1,
                                        geminiApiKey: data.geminiApiKey || '',
                                        aiModel: data.aiModel || 'gemini-2.5-flash',
                                        useFirebaseSync: data.useFirebaseSync || false
                                    });
                                }
                                console.log("🔥 Synced API & Sync settings to IndexedDB.");

                                // Auto-sync on load if enabled
                                const isSyncEnabled = data.useFirebaseSync !== undefined ? data.useFirebaseSync : localSettings?.useFirebaseSync;
                                if (isSyncEnabled) {
                                    console.log("🔥 Auto-syncing from Firebase Storage...");
                                    const { performSync } = await import('../services/sync_service');
                                    performSync(currentUser.uid).catch(e => console.error("Auto sync failed during init:", e));
                                }
                            } catch (syncErr) {
                                console.error("Failed to sync settings to local DB", syncErr);
                            }
                        }

                    } else {
                        console.warn("⚠️ Firestore doc does NOT exist at this path:", docPath);
                        setMembershipRank(null);
                    }
                } catch (error: any) {
                    console.error("❌ Error fetching user rank:", error?.code, error?.message, error);
                    setMembershipRank(null);
                }
            } else {
                console.log("🔥 No user is signed in.");
                setUserId(null);
                setMembershipRank(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Check if user has sufficient rank
    // Allow GUARDIAN and COVENANT (case-insensitive)
    const normalizedRank = membershipRank?.toUpperCase() || '';
    const hasAccess = normalizedRank === 'GUARDIAN' || normalizedRank === 'COVENANT';

    return (
        <AuthContext.Provider value={{ user, userId, membershipRank, loading, hasAccess }}>
            {children}
        </AuthContext.Provider>
    );
};
