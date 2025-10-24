import admin from "firebase-admin";
// Pastikan path ke file JSON Anda benar. '..' artinya "naik satu direktori".
// Dari /src/db/, kita perlu naik dua kali ke direktori root.
import serviceAccount from "../../firebase-adminsdk.json" with { type: "json" };

let db;
try {
    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("✅ Firebase Admin SDK Initialized from JSON file.");
    }
    db = admin.firestore();
} catch (error) {
    console.error("FATAL: Firebase initialization error. Make sure 'firebase-adminsdk.json' exists in the root directory and is valid.", error.message || error);
    process.exit(1);
}

const USERS_COLLECTION = "users";
const EVENT_SUMMIT_COLLECTION = "eventSummitGuides"; // Nama collection event
const META_COLLECTION = "metadata";

// --- Fungsi untuk Collection 'users' ---

export async function saveUser(userData) {
    if (!db) throw new Error("Firestore DB not initialized.");
    if (!userData || !userData.robloxId) throw new Error("Cannot save user data without a robloxId.");
    const docId = userData.robloxId;
    await db.collection(USERS_COLLECTION).doc(docId).set(userData, { merge: true });
    return userData;
}

export async function findUser(robloxId) {
    if (!db) return null;
    const doc = await db.collection(USERS_COLLECTION).doc(robloxId).get();
    if (doc.exists) {
        const data = doc.data();
        return {
            ...data,
            robloxId: doc.id,
            xp: data.xp || 0,
            expeditions: data.expeditions || 0,
            achievements: data.achievements || [],
            discordId: data.discordId || null,
            isVerified: data.isVerified || false,
        };
    }
    return null;
}

export async function findUserByDiscordId(discordId) {
    if (!db) return null;
    const snapshot = await db.collection(USERS_COLLECTION)
        .where('discordId', '==', discordId)
        .limit(1)
        .get();
    if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        return {
            ...data,
            robloxId: doc.id,
            xp: data.xp || 0,
            expeditions: data.expeditions || 0,
            achievements: data.achievements || [],
            discordId: data.discordId || null,
            isVerified: data.isVerified || false,
        };
    }
    return null;
}

export async function deleteUser(robloxId) {
    if (!db) throw new Error("Firestore DB not initialized.");
    await db.collection(USERS_COLLECTION).doc(robloxId).delete();
}

export async function countUsersWhere(field, operator, value) {
    if (!db) return 0;
    const snapshot = await db.collection(USERS_COLLECTION)
        .where(field, operator, value)
        .count().get();
    return snapshot.data().count;
}

export async function countTotalUsers() {
    if (!db) return 0;
    const snapshot = await db.collection(USERS_COLLECTION).count().get();
    return snapshot.data().count;
}

export async function getAllUsers() {
    if (!db) return [];
    const snapshot = await db.collection(USERS_COLLECTION).get();
    return snapshot.docs.map(doc => doc.data());
}

// --- Fungsi untuk Leaderboard XP & Ekspedisi ---

export async function findLeaderboardUsers(sortField, limit, offset) {
    if (!db || (sortField !== 'xp' && sortField !== 'expeditions')) return [];
    const snapshot = await db.collection(USERS_COLLECTION)
        .orderBy(sortField, 'desc')
        .orderBy('robloxId', 'asc')
        .limit(limit)
        .offset(offset)
        .get();

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            ...data,
            robloxId: doc.id,
            xp: data.xp || 0,
            expeditions: data.expeditions || 0
        };
    });
}

// --- Fungsi untuk Collection Event 'eventSummitGuides' ---

export async function getSummitGuideData(robloxId) {
    if (!db) return { guideCount: 0 };
    const doc = await db.collection(EVENT_SUMMIT_COLLECTION).doc(robloxId).get();
    if (doc.exists) {
        return doc.data();
    }
    return { guideCount: 0 };
}

export async function saveSummitGuideData(robloxId, data) {
    if (!db) throw new Error("Firestore DB not initialized.");
    await db.collection(EVENT_SUMMIT_COLLECTION).doc(robloxId).set(data, { merge: true });
}

export async function findSummitLeaderboard(limit, offset) {
    if (!db) return [];
    const snapshot = await db.collection(EVENT_SUMMIT_COLLECTION)
        .orderBy('guideCount', 'desc')
        .orderBy(admin.firestore.FieldPath.documentId(), 'asc')
        .limit(limit)
        .offset(offset)
        .get();
    return snapshot.docs.map(doc => ({
        robloxId: doc.id,
        guideCount: doc.data().guideCount || 0
    }));
}

// --- Fungsi untuk Collection 'metadata' (Untuk Milestone) ---

export async function getLastAnnouncedMilestone() {
    if (!db) return 0;
    const doc = await db.collection(META_COLLECTION).doc('milestones').get();
    if (doc.exists) {
        return doc.data().lastAnnounced || 0;
    }
    return 0;
}

export async function setLastAnnouncedMilestone(count) {
    if (!db) throw new Error("Firestore DB not initialized.");
    await db.collection(META_COLLECTION).doc('milestones').set({ lastAnnounced: count });
}
