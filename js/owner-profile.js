import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Elements
const form = document.getElementById('profile-form');
const nameInput = document.getElementById('name');
const addrInput = document.getElementById('address');
const hoursInput = document.getElementById('hours');
const capInput = document.getElementById('capacity');
const imgInput = document.getElementById('image-url');
const saveBtn = document.getElementById('save-btn');
const statusBadge = document.getElementById('save-status');

let currentOwnerId = null;
let currentRestaurantId = null; // To know if we update or create

// 1. Init Icons
document.addEventListener('DOMContentLoaded', () => {
    if(window.lucide) lucide.createIcons();
});

// 2. Auth Check & Load Data
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        currentOwnerId = user.uid;
        await loadRestaurantData();
    }
});

// 3. Load Existing Profile
async function loadRestaurantData() {
    saveBtn.innerText = "Loading...";
    saveBtn.disabled = true;

    try {
        // Find restaurant where ownerId == currentUid
        const q = query(collection(db, "restaurants"), where("ownerId", "==", currentOwnerId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Restaurant Exists -> Populate Form
            const docSnap = querySnapshot.docs[0];
            currentRestaurantId = docSnap.id;
            const data = docSnap.data();

            nameInput.value = data.name || '';
            addrInput.value = data.address || '';
            hoursInput.value = data.operatingHours || '';
            capInput.value = data.capacity || '';
            imgInput.value = data.imageUrl || '';
            
            console.log("Loaded Restaurant:", data.name);
        } else {
            console.log("No restaurant found. Ready to create new.");
        }
    } catch (error) {
        console.error("Error loading profile:", error);
    } finally {
        saveBtn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i> Save Changes`;
        saveBtn.disabled = false;
        if(window.lucide) lucide.createIcons();
    }
}

// 4. Handle Save (Create or Update)
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    saveBtn.innerText = "Saving...";
    saveBtn.disabled = true;

    const restaurantData = {
        ownerId: currentOwnerId, // IMPORTANT LINK
        name: nameInput.value.trim(),
        address: addrInput.value.trim(),
        operatingHours: hoursInput.value.trim(),
        capacity: parseInt(capInput.value),
        imageUrl: imgInput.value.trim()
    };

    try {
        if (currentRestaurantId) {
            // Update Existing
            const ref = doc(db, "restaurants", currentRestaurantId);
            await updateDoc(ref, restaurantData);
            showStatus("Updated Successfully!");
        } else {
            // Create New
            const docRef = await addDoc(collection(db, "restaurants"), restaurantData);
            currentRestaurantId = docRef.id;
            showStatus("Created Successfully!");
        }
    } catch (error) {
        console.error("Error saving:", error);
        alert("Failed to save: " + error.message);
    } finally {
        saveBtn.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i> Save Changes`;
        saveBtn.disabled = false;
        if(window.lucide) lucide.createIcons();
    }
});

// Helper: Show success message
function showStatus(msg) {
    statusBadge.innerText = msg;
    statusBadge.classList.remove('hidden');
    setTimeout(() => {
        statusBadge.classList.add('hidden');
    }, 3000);
}

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
});