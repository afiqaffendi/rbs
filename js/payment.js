<<<<<<< HEAD
import { auth, db } from './firebase-config.js'; // REMOVED 'storage'
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
=======
import { auth, db } from './firebase-config.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- TOYYIBPAY CONFIGURATION (DEV MODE) ---
const TOYYIB_SECRET_KEY = 'ssld1e1h-s9kj-nq2u-saau-a6v0xlt33sk1'; 
const TOYYIB_CATEGORY_CODE = 'i6g190ld'; 

// --- VARIABLES ---
let bookingData = null;
let userUid = null;
>>>>>>> a7b8c2229bb8759df2b709dc93c55420866e471a

// DOM Elements
const detailsDiv = document.getElementById('booking-details');
const totalDisplay = document.getElementById('display-total');
<<<<<<< HEAD
const refInput = document.getElementById('transaction-ref'); // CHANGED
const submitBtn = document.getElementById('confirm-payment-btn');
const statusMsg = document.getElementById('upload-status');
=======
const fpxBtn = document.getElementById('pay-fpx-btn');
const loadingOverlay = document.getElementById('loading-overlay');
>>>>>>> a7b8c2229bb8759df2b709dc93c55420866e471a

// 1. Check Login & Load Data
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

<<<<<<< HEAD
    let menuHtml = bookingData.menuItems.length > 0 
        ? `<ul>${bookingData.menuItems.map(item => `<li>${item.name}</li>`).join('')}</ul>`
        : 'No pre-order items';
=======
    // FIX: Fallback logic for Price and Menu
    const displayPrice = bookingData.totalCost || bookingData.deposit || 0;
    const items = bookingData.menuItems || [];

    // Display Data
    let itemsHtml = '';
    if(items.length > 0) {
        itemsHtml = items.map(item => 
            `<p class="flex justify-between"><span>${item.qty}x ${item.name}</span> <span>RM ${(item.price * item.qty).toFixed(2)}</span></p>`
        ).join('');
    } else {
        itemsHtml = '<p>Table Reservation Only</p>';
    }
>>>>>>> a7b8c2229bb8759df2b709dc93c55420866e471a

    detailsDiv.innerHTML = `
        <p><strong>Restaurant:</strong> ${bookingData.restaurantName}</p>
        <p><strong>Date:</strong> ${bookingData.date} @ ${bookingData.timeSlot}</p>
        <div class="pl-2 border-l-2 border-slate-200 my-2 text-xs">
            ${itemsHtml}
        </div>
    `;
    totalDisplay.innerText = `RM ${parseFloat(displayPrice).toFixed(2)}`;
}

<<<<<<< HEAD
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
=======
// ==========================================
// TOYYIBPAY (Online Banking) LOGIC
// ==========================================
if(fpxBtn) {
    fpxBtn.addEventListener('click', async () => {
        if (!bookingData) return;

        const originalText = fpxBtn.innerHTML;
        fpxBtn.innerHTML = "Connecting...";
        fpxBtn.disabled = true;

        // 1. CALCULATE AMOUNT
        // Priority: totalCost > deposit > 0
        let rawPrice = bookingData.totalCost || bookingData.deposit || 0;
        let amountInCents = Math.round(parseFloat(rawPrice) * 100); 

        // SAFETY CHECK: ToyyibPay requires minimum RM 1.00 (100 cents)
        if (amountInCents < 100) {
            alert(`Error: The payment amount (RM ${rawPrice}) is too low. ToyyibPay requires at least RM 1.00.`);
            fpxBtn.innerHTML = originalText;
            fpxBtn.disabled = false;
            return;
        }

        // 2. Prepare Data (URLSearchParams for Proxy compatibility)
        const params = new URLSearchParams();
        params.append('userSecretKey', TOYYIB_SECRET_KEY);
        params.append('categoryCode', TOYYIB_CATEGORY_CODE);
        params.append('billName', `DTEBS: ${bookingData.restaurantName}`);
        params.append('billDescription', `Booking: ${bookingData.date}, ${bookingData.timeSlot}`);
        params.append('billPriceSetting', 1);
        params.append('billPayorInfo', 1);
        params.append('billAmount', amountInCents);
        params.append('billReturnUrl', window.location.href.split('?')[0] + '?status=success'); 
        params.append('billCallbackUrl', 'https://reqres.in/api/users'); 
        params.append('billExternalReferenceNo', Date.now().toString());
        params.append('billTo', 'Customer');
        params.append('billEmail', 'customer@email.com');
        params.append('billPhone', '0123456789');

        try {
            // 3. Send to ToyyibPay DEV via Proxy
            const proxyUrl = 'https://corsproxy.io/?'; 
            const targetUrl = 'https://dev.toyyibpay.com/index.php/api/createBill';

            const response = await fetch(proxyUrl + encodeURIComponent(targetUrl), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params
            });

            const data = await response.json();

            // 4. Redirect User
            if (data && data[0] && data[0].BillCode) {
                const billCode = data[0].BillCode;
                sessionStorage.setItem('pending_bill_code', billCode);
                
                // Redirect to DEV Payment Page
                window.location.href = `https://dev.toyyibpay.com/${billCode}`;
            } else {
                console.error("API Error:", data);
                
                let errorMsg = "Unknown Error";
                if(data[0] && data[0].msg) errorMsg = data[0].msg;
                else if (typeof data === 'string') errorMsg = data;
                else errorMsg = JSON.stringify(data);

                alert("ToyyibPay Error: " + errorMsg);
                fpxBtn.innerHTML = originalText;
                fpxBtn.disabled = false;
            }

        } catch (error) {
            console.error("Connection Error:", error);
            alert("Network Error: Could not connect to ToyyibPay.");
            fpxBtn.innerHTML = originalText;
            fpxBtn.disabled = false;
        }
    });
}

// ==========================================
// HELPER: SAVE TO FIREBASE
// ==========================================
async function saveBookingToFirestore(method, refOrUrl, status) {
    if(loadingOverlay) loadingOverlay.classList.remove('hidden');

    try {
        const finalCost = parseFloat(bookingData.totalCost || bookingData.deposit || 0);

>>>>>>> a7b8c2229bb8759df2b709dc93c55420866e471a
        await addDoc(collection(db, "bookings"), {
            restaurantId: bookingData.restaurantId,
            restaurantName: bookingData.restaurantName,
            customerId: userUid,
            bookingDate: bookingData.date,
            timeSlot: bookingData.timeSlot,
            pax: parseInt(bookingData.pax),
<<<<<<< HEAD
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
=======
            menuItems: bookingData.menuItems || [],
            totalCost: finalCost,
            paymentMethod: method, // 'toyyibpay'
            paymentRef: refOrUrl, // BillCode
            status: status, 
            createdAt: Timestamp.now()
        });

        sessionStorage.removeItem('tempBooking');
        sessionStorage.removeItem('pending_bill_code');
        
        setTimeout(() => {
            alert("Payment Successful! Booking Confirmed.");
            window.location.href = 'customer-bookings.html';
        }, 1000);
>>>>>>> a7b8c2229bb8759df2b709dc93c55420866e471a

    } catch (error) {
        console.error("Save Error:", error);
        alert("Payment done, but failed to save booking. Screenshot this!");
        if(loadingOverlay) loadingOverlay.classList.add('hidden');
    }
}

// ==========================================
// HANDLE RETURN FROM TOYYIBPAY
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const billCode = urlParams.get('billcode'); 

    if (status === 'success' || urlParams.get('status_id') == 1) {
        if(sessionStorage.getItem('tempBooking')) {
            bookingData = JSON.parse(sessionStorage.getItem('tempBooking'));
            const savedBillCode = sessionStorage.getItem('pending_bill_code') || billCode || 'online';
            saveBookingToFirestore("toyyibpay", savedBillCode, "confirmed");
        }
    }
});