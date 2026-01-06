import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const signupForm = document.getElementById('signup-form');
const errorMsg = document.getElementById('signup-error-msg');

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const role = document.getElementById('signup-role').value;

    errorMsg.innerText = "Creating account...";

    try {
        // 1. Create Authentication User in Firebase
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Save User Role to Firestore
        // We use setDoc with the user's UID so auth.js can find it easily later
        await setDoc(doc(db, "users", user.uid), {
            email: email,
            role: role,
            createdAt: new Date().toISOString()
        });

        // 3. Success Feedback & Redirect
        alert("Account created successfully!");

        if (role === 'Restaurant Owner') {
            window.location.href = 'owner-dashboard.html';
        } else {
            window.location.href = 'customer-home.html';
        }

    } catch (error) {
        console.error("Signup Error:", error);
        
        // Handle common errors gracefully
        if (error.code === 'auth/email-already-in-use') {
            errorMsg.innerText = "That email is already registered.";
        } else if (error.code === 'auth/weak-password') {
            errorMsg.innerText = "Password should be at least 6 characters.";
        } else {
            errorMsg.innerText = "Error: " + error.message;
        }
    }
});