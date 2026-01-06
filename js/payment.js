import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// DOM Elements
const detailsDiv = document.getElementById('booking-details');
const totalDisplay = document.getElementById('display-total');
const fileInput = document.getElementById('receipt-upload');
const previewImg = document.getElementById('preview-img');
const submitBtn = document.getElementById('confirm-payment-btn');
const statusMsg = document.getElementById('upload-status');

// Variables
let bookingData = null;
let userUid = null;

// 1. Check Login & Retrieve Data
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        userUid = user.uid;
        loadBookingData();
    }
});

function loadBookingData() {
    // Get data saved from previous page
    const dataStr = sessionStorage.getItem('tempBooking');
    if (!dataStr) {
        alert("No booking found. Redirecting to home.");
        window.location.href = 'customer-home.html';
        return;
    }

    bookingData = JSON.parse(dataStr);

    // Display Data
    let menuHtml = bookingData.menuItems.length > 0 
        ? `<ul>${bookingData.menuItems.map(item => `<li>${item.name}</li>`).join('')}</ul>`
        : 'No pre-order items';

    detailsDiv.innerHTML = `
        <p><strong>Restaurant:</strong> ${bookingData.restaurantName}</p>
        <p><strong>Date:</strong> ${bookingData.date}</p>
        <p><strong>Time:</strong> ${bookingData.timeSlot}</p>
        <p><strong>Pax:</strong> ${bookingData.pax} people</p>
        <p><strong>Menu Items:</strong></p>
        ${menuHtml}
    `;
    totalDisplay.innerText = `RM ${bookingData.totalCost}`;
}

// 2. Handle File Selection (Preview)
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            previewImg.style.display = 'block';
        };
        reader.readAsDataURL(file);
        submitBtn.disabled = false; // Enable button
        submitBtn.style.backgroundColor = '#28a745';
    }
});

// 3. Handle Submit (Upload & Save)
submitBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    submitBtn.disabled = true;
    submitBtn.innerText = "Uploading...";
    statusMsg.innerText = "Please wait, uploading receipt...";

    try {
        // A. Upload Image to Firebase Storage
        const storageRef = ref(storage, `receipts/${userUid}_${Date.now()}.jpg`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        console.log("File uploaded at:", downloadURL);

        // B. Save Booking to Firestore
        await addDoc(collection(db, "bookings"), {
            restaurantId: bookingData.restaurantId,
            restaurantName: bookingData.restaurantName, // Useful for display
            customerId: userUid,
            bookingDate: bookingData.date,
            timeSlot: bookingData.timeSlot,
            pax: parseInt(bookingData.pax),
            menuItems: bookingData.menuItems,
            totalCost: parseFloat(bookingData.totalCost),
            receiptUrl: downloadURL,
            status: "pending_verification", // The default status
            createdAt: Timestamp.now()
        });

        // C. Success & Redirect
        alert("Payment Submitted! Waiting for verification.");
        sessionStorage.removeItem('tempBooking'); // Clear temp data
        window.location.href = 'customer-bookings.html'; // We will build this next

    } catch (error) {
        console.error("Error:", error);
        statusMsg.innerText = "Error: " + error.message;
        submitBtn.disabled = false;
        submitBtn.innerText = "Try Again";
    }
});