import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showToast } from './toast.js';

const signupForm = document.getElementById('signup-form');
const errorMsg = document.getElementById('signup-error-msg');

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const role = document.getElementById('signup-role').value;

    errorMsg.innerText = "Creating account...";

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
            email: email,
            role: role,
            createdAt: new Date().toISOString()
        });

        showToast("Account created successfully!");

        setTimeout(() => {
            if (role === 'Restaurant Owner') {
                window.location.href = 'owner-dashboard.html';
            } else {
                window.location.href = 'customer-home.html';
            }
        }, 1500);

    } catch (error) {
        console.error("Signup Error:", error);
        if (error.code === 'auth/email-already-in-use') {
            errorMsg.innerText = "That email is already registered.";
        } else if (error.code === 'auth/weak-password') {
            errorMsg.innerText = "Password should be at least 6 characters.";
        } else {
            errorMsg.innerText = "Error: " + error.message;
        }
        showToast("Signup failed. Check details.", "error");
    }
});