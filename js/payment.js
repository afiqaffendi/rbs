import { auth, db } from './firebase-config.js'; // REMOVED 'storage'
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM Elements
const detailsDiv = document.getElementById('booking-details');
const totalDisplay = document.getElementById('display-total');
const refInput = document.getElementById('transaction-ref'); // CHANGED
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
    const dataStr = sessionStorage.getItem('tempBooking');
    if (!dataStr) {
        alert("No booking found. Redirecting to home.");
        window.location.href = 'customer-home.html';
        return;
    }

    bookingData = JSON.parse(dataStr);

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

// 2. Enable Button when user types
refInput.addEventListener('input', (e) => {
    if (e.target.value.trim().length > 3) {
        submitBtn.disabled = false;
        submitBtn.style.backgroundColor = '#28a745';
        submitBtn.style.cursor = 'pointer';
    } else {
        submitBtn.disabled = true;
        submitBtn.style.backgroundColor = '#ccc';
    }
});

// 3. Handle Submit (Save Text Only)
submitBtn.addEventListener('click', async () => {
    const refCode = refInput.value.trim();
    if (!refCode) return;

    submitBtn.disabled = true;
    submitBtn.innerText = "Verifying...";
    statusMsg.innerText = "Submitting booking...";

    try {
        // SAVE TO FIRESTORE (No Image Upload)
        await addDoc(collection(db, "bookings"), {
            restaurantId: bookingData.restaurantId,
            restaurantName: bookingData.restaurantName,
            customerId: userUid,
            bookingDate: bookingData.date,
            timeSlot: bookingData.timeSlot,
            pax: parseInt(bookingData.pax),
            menuItems: bookingData.menuItems,
            totalCost: parseFloat(bookingData.totalCost),
            
            // NEW FIELD: Transaction Reference
            transactionRef: refCode, 
            
            status: "pending_verification",
            createdAt: Timestamp.now()
        });

        // Success & Redirect
        alert("Payment Reference Submitted! Waiting for verification.");
        sessionStorage.removeItem('tempBooking');
        window.location.href = 'customer-bookings.html';

    } catch (error) {
        console.error("Error:", error);
        statusMsg.innerText = "Error: " + error.message;
        submitBtn.disabled = false;
        submitBtn.innerText = "Try Again";
    }
});