import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showToast } from './toast.js';

const form = document.getElementById('profile-form');
let currentDocId = null;
let userUid = null;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    populateTimeSelects(); 
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

// Helper to Generate Time Options
function populateTimeSelects() {
    const startSelect = document.getElementById('time-start');
    const endSelect = document.getElementById('time-end');
    
    if(!startSelect || !endSelect) return;

    const times = [];
    for(let i=0; i<24; i++) {
        for(let j=0; j<2; j++) {
            const h = i;
            const m = j === 0 ? "00" : "30";
            let amp = h >= 12 ? "PM" : "AM";
            let displayH = h % 12 || 12; 
            times.push(`${displayH}:${m} ${amp}`);
        }
    }

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
        document.getElementById('res-image').value = data.imageUrl || '';

        if (data.operatingHours && data.operatingHours.includes(' - ')) {
            const [start, end] = data.operatingHours.split(' - ');
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

    const startVal = document.getElementById('time-start').value;
    const endVal = document.getElementById('time-end').value;
    const combinedHours = `${startVal} - ${endVal}`; 

    const data = {
        ownerId: userUid,
        name: document.getElementById('res-name').value,
        address: document.getElementById('res-address').value,
        operatingHours: combinedHours, 
        imageUrl: document.getElementById('res-image').value
    };

    try {
        if (currentDocId) {
            await updateDoc(doc(db, "restaurants", currentDocId), data);
        } else {
            await addDoc(collection(db, "restaurants"), data);
        }
        showToast("Profile Saved Successfully!");
        setTimeout(() => window.location.href = 'owner-dashboard.html', 1500);
    } catch (error) {
        console.error("Error:", error);
        showToast("Save Failed: " + error.message, "error");
        btn.innerText = originalText;
        btn.disabled = false;
    }
});