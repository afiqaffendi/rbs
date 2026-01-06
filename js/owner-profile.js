import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById('profile-form');
let currentDocId = null;
let userUid = null;

// 1. Auth Check
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        userUid = user.uid;
        loadProfile();
    }
});

// 2. Load Existing Data
async function loadProfile() {
    // Find restaurant owned by this user
    const q = query(collection(db, "restaurants"), where("ownerId", "==", userUid));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        currentDocId = docSnap.id;
        const data = docSnap.data();

        document.getElementById('res-name').value = data.name;
        document.getElementById('res-address').value = data.address;
        document.getElementById('res-hours').value = data.operatingHours;
        document.getElementById('res-capacity').value = data.capacity;
        document.getElementById('res-image').value = data.imageUrl || '';
    }
}

// 3. Save Data
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('save-btn');
    const originalText = btn.innerText;
    
    btn.innerText = "Saving...";
    btn.disabled = true;

    const data = {
        ownerId: userUid,
        name: document.getElementById('res-name').value,
        address: document.getElementById('res-address').value,
        operatingHours: document.getElementById('res-hours').value,
        capacity: parseInt(document.getElementById('res-capacity').value),
        imageUrl: document.getElementById('res-image').value
    };

    try {
        if (currentDocId) {
            // Update
            await updateDoc(doc(db, "restaurants", currentDocId), data);
        } else {
            // Create New
            await addDoc(collection(db, "restaurants"), data);
        }
        alert("Profile Saved Successfully!");
        window.location.href = 'owner-dashboard.html';
    } catch (error) {
        console.error("Error:", error);
        alert("Save Failed: " + error.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
});