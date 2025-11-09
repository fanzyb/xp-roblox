import admin from "firebase-admin";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

// 1. Muat kredensial
dotenv.config();
import serviceAccount from "./firebase-adminsdk.json" with { type: "json" };

// Kumpulan koleksi yang ada di Firestore-mu
// (Berdasarkan file firestore.js kamu)
const COLLECTIONS_TO_BACKUP = ["users", "eventSummitGuides", "metadata"];

// --- Fungsi Utama ---

async function runBackup() {
    // --- 2. Inisialisasi Firebase ---
    console.log("Connecting to Firebase...");
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (e) {
        if (e.code !== 'app/duplicate-app') throw e; // Abaikan jika sudah inisialisasi
    }
    const firestoreDb = admin.firestore();
    console.log("✅ Connected to Firebase.");

    // --- 3. Inisialisasi MongoDB ---
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error("FATAL: MONGODB_URI not found in .env file.");
        return;
    }
    
    console.log("Connecting to MongoDB...");
    const mongoClient = new MongoClient(mongoUri);
    let mongoDb;
    try {
        await mongoClient.connect();
        mongoDb = mongoClient.db(); // Menggunakan database default dari URI
        console.log("✅ Connected to MongoDB.");
    } catch (e) {
        console.error("FATAL: Could not connect to MongoDB.", e.message);
        return;
    }

    // --- 4. Proses Backup ---
    try {
        console.log("\nStarting backup process...");

        for (const collectionName of COLLECTIONS_TO_BACKUP) {
            console.log(`\n--- Backing up collection: '${collectionName}' ---`);
            
            // Ambil semua data dari koleksi Firestore
            const snapshot = await firestoreDb.collection(collectionName).get();
            if (snapshot.empty) {
                console.log("No documents found. Skipping.");
                continue;
            }

            const documents = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                // Penting: MongoDB menggunakan _id, bukan doc.id
                // Kita akan simpan ID asli Firestore di field 'firestore_id'
                documents.push({
                    ...data,
                    firestore_id: doc.id // Simpan ID asli
                });
            });

            console.log(`Found ${documents.length} documents.`);

            // Hapus koleksi lama di MongoDB (jika ada) untuk backup bersih
            try {
                await mongoDb.collection(collectionName).drop();
                console.log(`Dropped old backup collection '${collectionName}'.`);
            } catch (dropErr) {
                if (dropErr.codeName !== 'NamespaceNotFound') {
                    console.warn(`Could not drop collection: ${dropErr.message}`);
                } else {
                    console.log(`Collection '${collectionName}' did not exist. Creating new.`);
                }
            }

            // Masukkan data baru ke MongoDB
            const result = await mongoDb.collection(collectionName).insertMany(documents);
            console.log(`✅ Successfully inserted ${result.insertedCount} documents into MongoDB.`);
        }

        console.log("\n--- Backup Complete! ---");

    } catch (error) {
        console.error("\n--- ERROR DURING BACKUP ---", error);
    } finally {
        // --- 5. Tutup Koneksi ---
        await mongoClient.close();
        console.log("Disconnected from MongoDB.");
        // Koneksi Firebase Admin tidak perlu ditutup manual
    }
}

// Jalankan fungsi
runBackup();