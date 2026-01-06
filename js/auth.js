// js/auth.js
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const loginForm = document.getElementById('login-form');
const errorMsg = document.getElementById('error-msg');

// 1. Check if user is ALREADY logged in (Auto-redirect)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("User detected, checking role...");
        await checkRoleAndRedirect(user.uid);
    }
});

// 2. Handle Login Button Click
if(loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Stop page refresh
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        errorMsg.textContent = "Logging in...";

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            await checkRoleAndRedirect(userCredential.user.uid);
        } catch (error) {
            console.error(error);
            errorMsg.textContent = "Error: " + error.message;
            errorMsg.style.color = "red";
        }
    });
}

// 3. Helper Function: Read Role from Firestore
async function checkRoleAndRedirect(uid) {
    try {
        const userDocRef = doc(db, "users", uid); // Ensure collection name is 'users'
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            const role = userData.role; // Ensure field name is 'role'

            console.log("User Role:", role);

            if (role === 'Restaurant Owner') {
                window.location.href = 'owner-dashboard.html';
            } else {
                window.location.href = 'customer-home.html';
            }
        } else {
            errorMsg.textContent = "User data not found in database!";
        }
    } catch (error) {
        console.error("Firestore Error:", error);
        errorMsg.textContent = "Database Connection Error";
    }
}