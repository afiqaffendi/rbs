import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM Elements
const nameInput = document.getElementById('profile-name');
const phoneInput = document.getElementById('profile-phone');
const headerName = document.getElementById('display-name-header');
const headerEmail = document.getElementById('display-email-header');
const statBookings = document.getElementById('stat-bookings');
const statSpent = document.getElementById('stat-spent');
const saveBtn = document.getElementById('save-btn');
const changePwdBtn = document.getElementById('change-pwd-btn');
const logoutBtn = document.getElementById('logout-btn');
const form = document.getElementById('profile-form');

let userUid = null;
let userEmail = null;

// 1. Auth Check
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        userUid = user.uid;
        userEmail = user.email;
        headerEmail.innerText = user.email;
        
        await loadUserData(user);
        await loadUserStats(user.uid);
    }
});

// 2. Load User Data
async function loadUserData(user) {
    try {
        const docRef = doc(db, "users", userUid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Fill Inputs
            nameInput.value = data.displayName || '';
            phoneInput.value = data.phoneNumber || '';
            headerName.innerText = data.displayName || 'Valued Customer';
        }
    } catch (error) {
        console.error("Error loading profile:", error);
    }
}

// 3. Load Gamification Stats
async function loadUserStats(uid) {
    try {
        const q = query(
            collection(db, "bookings"), 
            where("customerId", "==", uid),
            where("status", "==", "confirmed") 
        );

        const querySnapshot = await getDocs(q);
        
        let totalCount = 0;
        let totalSpent = 0;

        querySnapshot.forEach(doc => {
            const data = doc.data();
            totalCount++;
            totalSpent += parseFloat(data.totalCost || 0);
        });

        statBookings.innerText = totalCount;
        statSpent.innerText = `RM ${totalSpent.toFixed(2)}`;

    } catch (error) {
        console.error("Error calculating stats:", error);
    }
}

// 4. Save Changes (Updated: Removed Diet Logic)
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newName = nameInput.value.trim();
    const newPhone = phoneInput.value.trim();

    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="animate-spin mr-2">⏳</span> Saving...`;

    try {
        const userRef = doc(db, "users", userUid);
        
        await updateDoc(userRef, {
            displayName: newName,
            phoneNumber: newPhone,
            lastUpdated: new Date().toISOString()
        });

        headerName.innerText = newName || 'Valued Customer';
        alert("Profile updated successfully!");

    } catch (error) {
        console.error("Error saving profile:", error);
        alert("Failed to save changes.");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i data-lucide="save" class="w-4 h-4 mr-2"></i> Save Changes`;
        if(window.lucide) lucide.createIcons();
    }
});

// 5. Change Password Logic
changePwdBtn.addEventListener('click', async () => {
    if(confirm(`Send a password reset email to ${userEmail}?`)) {
        try {
            await sendPasswordResetEmail(auth, userEmail);
            alert(`Email sent! Check your inbox at ${userEmail} to reset your password.`);
        } catch (error) {
            console.error("Error sending reset email:", error);
            alert("Error: " + error.message);
        }
    }
});

// 6. Logout Logic
logoutBtn.addEventListener('click', async () => {
    if(confirm("Are you sure you want to log out?")) {
        try {
            await signOut(auth);
            window.location.href = 'index.html';
        } catch (error) {
            console.error("Logout Error:", error);
        }
    }
});