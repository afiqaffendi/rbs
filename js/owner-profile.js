import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById('profile-form');
let currentDocId = null;
let userUid = null;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    populateTimeSelects(); // Generate the dropdown options immediately
});

// 1. Auth Check
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        userUid = user.uid;
        loadProfile();
    }
});

// --- NEW: Helper to Generate Time Options (30 min intervals) ---
function populateTimeSelects() {
    const startSelect = document.getElementById('time-start');
    const endSelect = document.getElementById('time-end');
    
    if(!startSelect || !endSelect) return;

    const times = [];
    // Generate times from 00:00 to 23:30
    for(let i=0; i<24; i++) {
        for(let j=0; j<2; j++) {
            const h = i;
            const m = j === 0 ? "00" : "30";
            
            // Convert to 12-hour format
            let amp = h >= 12 ? "PM" : "AM";
            let displayH = h % 12 || 12; // Convert 0 -> 12
            
            times.push(`${displayH}:${m} ${amp}`);
        }
    }

    // Fill both dropdowns
    const createOptions = (select) => {
        select.innerHTML = '';
        times.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.innerText = t;
            select.appendChild(opt);
        });
    };

    createOptions(startSelect);
    createOptions(endSelect);

    // Set Defaults
    startSelect.value = "10:00 AM";
    endSelect.value = "10:00 PM";
}

// 2. Load Existing Data
async function loadProfile() {
    const q = query(collection(db, "restaurants"), where("ownerId", "==", userUid));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        currentDocId = docSnap.id;
        const data = docSnap.data();

        document.getElementById('res-name').value = data.name;
        document.getElementById('res-address').value = data.address;
        document.getElementById('res-capacity').value = data.capacity;
        document.getElementById('res-image').value = data.imageUrl || '';

        // --- NEW: Split stored string back into Dropdowns ---
        if (data.operatingHours && data.operatingHours.includes(' - ')) {
            const [start, end] = data.operatingHours.split(' - ');
            // Clean trim just in case
            document.getElementById('time-start').value = start.trim();
            document.getElementById('time-end').value = end.trim();
        }
    }
}

// 3. Save Data
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('save-btn');
    const originalText = btn.innerText;
    
    btn.innerText = "Saving...";
    btn.disabled = true;

    // --- NEW: Combine Dropdowns into String ---
    const startVal = document.getElementById('time-start').value;
    const endVal = document.getElementById('time-end').value;
    const combinedHours = `${startVal} - ${endVal}`; 

    const data = {
        ownerId: userUid,
        name: document.getElementById('res-name').value,
        address: document.getElementById('res-address').value,
        operatingHours: combinedHours, // Saves as "10:00 AM - 10:00 PM"
        capacity: parseInt(document.getElementById('res-capacity').value),
        imageUrl: document.getElementById('res-image').value
    };

    try {
        if (currentDocId) {
            await updateDoc(doc(db, "restaurants", currentDocId), data);
        } else {
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