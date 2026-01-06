import { auth, db } from './firebase-config.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- TOYYIBPAY CONFIGURATION (DEV MODE) ---
const TOYYIB_SECRET_KEY = 'ssld1e1h-s9kj-nq2u-saau-a6v0xlt33sk1'; 
const TOYYIB_CATEGORY_CODE = 'i6g190ld'; 

// --- VARIABLES ---
let bookingData = null;
let userUid = null;

// DOM Elements
const detailsDiv = document.getElementById('booking-details');
const totalDisplay = document.getElementById('display-total');
const fpxBtn = document.getElementById('pay-fpx-btn');
const loadingOverlay = document.getElementById('loading-overlay');

// 1. Check Login & Load Data
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        userUid = user.uid;
        // Check if this is a RETURN from Payment first
        checkReturnFromPayment();
        loadBookingData();
    }
});

function loadBookingData() {
    const dataStr = sessionStorage.getItem('tempBooking');
    if (!dataStr) {
        // If we just finished payment, we might have cleared this, so ignore
        return; 
    }
    bookingData = JSON.parse(dataStr);

    const displayPrice = bookingData.totalCost || bookingData.deposit || 0;
    const items = bookingData.menuItems || [];

    let itemsHtml = items.length > 0 
        ? items.map(item => `<p class="flex justify-between"><span>${item.qty}x ${item.name}</span> <span>RM ${(item.price * item.qty).toFixed(2)}</span></p>`).join('')
        : '<p>Table Reservation Only</p>';

    if(detailsDiv) {
        detailsDiv.innerHTML = `
            <p><strong>Restaurant:</strong> ${bookingData.restaurantName}</p>
            <p><strong>Date:</strong> ${bookingData.date} @ ${bookingData.timeSlot}</p>
            <div class="pl-2 border-l-2 border-slate-200 my-2 text-xs">${itemsHtml}</div>
        `;
    }
    if(totalDisplay) {
        totalDisplay.innerText = `RM ${parseFloat(displayPrice).toFixed(2)}`;
    }
}

// 2. Handle Payment Button Click
if(fpxBtn) {
    fpxBtn.addEventListener('click', async () => {
        if (!bookingData) return;

        const originalText = fpxBtn.innerHTML;
        fpxBtn.innerHTML = "Connecting...";
        fpxBtn.disabled = true;

        const rawPrice = bookingData.totalCost || bookingData.deposit || 0;
        const amountInCents = Math.round(parseFloat(rawPrice) * 100); 

        if (amountInCents < 100) {
            alert(`Error: Amount RM ${rawPrice} is too low. Minimum RM 1.00.`);
            fpxBtn.innerHTML = originalText;
            fpxBtn.disabled = false;
            return;
        }

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
            const proxyUrl = 'https://corsproxy.io/?'; 
            const targetUrl = 'https://dev.toyyibpay.com/index.php/api/createBill';

            const response = await fetch(proxyUrl + encodeURIComponent(targetUrl), {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params
            });

            const data = await response.json();

            if (data && data[0] && data[0].BillCode) {
                const billCode = data[0].BillCode;
                sessionStorage.setItem('pending_bill_code', billCode);
                window.location.href = `https://dev.toyyibpay.com/${billCode}`;
            } else {
                alert("ToyyibPay Error: " + JSON.stringify(data));
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

// 3. Handle Return from Payment (The Important Part)
async function checkReturnFromPayment() {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const statusId = urlParams.get('status_id');
    const billCode = urlParams.get('billcode');

    // Check if URL indicates success
    if (status === 'success' || statusId == 1) {
        
        const dataStr = sessionStorage.getItem('tempBooking');
        if(!dataStr) {
            console.log("No temp booking data found (already saved or lost).");
            return;
        }

        const savedData = JSON.parse(dataStr);
        const savedBillCode = sessionStorage.getItem('pending_bill_code') || billCode || 'online';

        // Show Loading
        if(loadingOverlay) loadingOverlay.classList.remove('hidden');
        
        try {
            // FORCE SAVE
            await addDoc(collection(db, "bookings"), {
                restaurantId: savedData.restaurantId,
                restaurantName: savedData.restaurantName,
                customerId: userUid,
                bookingDate: savedData.date,
                timeSlot: savedData.timeSlot,
                pax: parseInt(savedData.pax),
                menuItems: savedData.menuItems || [],
                totalCost: parseFloat(savedData.totalCost || savedData.deposit || 0),
                paymentMethod: 'toyyibpay',
                paymentRef: savedBillCode,
                status: 'confirmed',
                createdAt: Timestamp.now()
            });

            // Cleanup
            sessionStorage.removeItem('tempBooking');
            sessionStorage.removeItem('pending_bill_code');

            alert("Payment Success! Booking Confirmed.");
            window.location.href = 'customer-bookings.html';

        } catch (error) {
            console.error("Save Error:", error);
            alert("Payment Success, but Save Failed: " + error.message);
            if(loadingOverlay) loadingOverlay.classList.add('hidden');
        }
    }
}