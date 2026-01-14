import { auth, db } from './firebase-config.js'; 
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showToast } from './toast.js';

// --- CONFIG ---
const TOYYIB_SECRET_KEY = 'ssld1e1h-s9kj-nq2u-saau-a6v0xlt33sk1'; 
const TOYYIB_CATEGORY_CODE = 'i6g190ld'; 

let bookingData = null;
let bookingId = new URLSearchParams(window.location.search).get('id');

const detailsDiv = document.getElementById('booking-details');
const totalDisplay = document.getElementById('display-total');
const fpxBtn = document.getElementById('pay-fpx-btn');
const loadingOverlay = document.getElementById('loading-overlay');

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        if(bookingId) {
            checkReturnFromPayment();
            loadBookingFromFirestore(bookingId);
        } else {
            showToast("No Booking ID found.", "error");
            setTimeout(() => window.location.href = 'customer-home.html', 1500);
        }
    }
});

async function loadBookingFromFirestore(id) {
    try {
        const docRef = doc(db, "bookings", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            bookingData = docSnap.data();
            renderBookingUI();
        } else {
            console.error("No such document!");
            detailsDiv.innerHTML = '<p class="text-red-500">Booking not found.</p>';
        }
    } catch (error) {
        console.error("Error loading booking:", error);
        detailsDiv.innerHTML = '<p class="text-red-500">Error loading booking details.</p>';
    }
}

function renderBookingUI() {
    // FIX: Use deposit (RM 50) if available, otherwise fallback (legacy support)
    const depositAmount = bookingData.deposit || 50.00;
    
    // UI displays Food info but emphasizes Deposit
    const items = bookingData.menuItems || [];
    let itemsHtml = items.length > 0 
        ? items.map(item => `<p class="flex justify-between text-xs text-slate-500"><span>${item.qty}x ${item.name}</span> <span>RM ${(item.price * item.qty).toFixed(2)}</span></p>`).join('')
        : '<p class="text-slate-400 italic">Table Reservation Only</p>';

    if(detailsDiv) {
        detailsDiv.innerHTML = `
            <p><strong>Restaurant:</strong> ${bookingData.restaurantName}</p>
            <p><strong>Date:</strong> ${bookingData.bookingDate} @ ${bookingData.timeSlot}</p>
            <p><strong>Guests:</strong> ${bookingData.pax} Pax</p>
            
            <div class="mt-4 pt-4 border-t border-slate-100">
                <p class="font-bold text-xs uppercase text-slate-400 mb-2">Food Pre-Order (Pay Later)</p>
                <div class="space-y-1 mb-2 max-h-24 overflow-y-auto">${itemsHtml}</div>
                <p class="text-right text-xs font-bold text-slate-500">Food Total: RM ${(bookingData.estimatedFoodCost || 0).toFixed(2)}</p>
            </div>
            
            <div class="mt-4 pt-2 border-t border-slate-100 bg-teal-50 p-2 rounded-lg">
                <p class="font-bold text-teal-800 text-xs">Deposit Due Now: RM ${depositAmount.toFixed(2)}</p>
            </div>
        `;
    }
    
    // Main Display shows Deposit
    if(totalDisplay) {
        totalDisplay.innerText = `RM ${parseFloat(depositAmount).toFixed(2)}`;
    }
    
    if(bookingData.status === 'confirmed') {
        if(fpxBtn) {
            fpxBtn.disabled = true;
            fpxBtn.innerText = "DEPOSIT PAID";
            fpxBtn.classList.remove('bg-slate-900');
            fpxBtn.classList.add('bg-green-600');
        }
    }
}

if(fpxBtn) {
    fpxBtn.addEventListener('click', async () => {
        if (!bookingData) return;

        const originalText = fpxBtn.innerHTML;
        fpxBtn.innerHTML = "Connecting...";
        fpxBtn.disabled = true;

        // FIX: Ensure we charge ONLY the deposit
        const chargeAmount = bookingData.deposit || 50.00;
        const amountInCents = Math.round(parseFloat(chargeAmount) * 100); 

        const returnUrl = `${window.location.origin}${window.location.pathname}?id=${bookingId}&status=success`;

        const params = new URLSearchParams();
        params.append('userSecretKey', TOYYIB_SECRET_KEY);
        params.append('categoryCode', TOYYIB_CATEGORY_CODE);
        params.append('billName', `Deposit: ${bookingData.restaurantName}`);
        params.append('billDescription', `Booking Deposit ID: ${bookingId}`);
        params.append('billPriceSetting', 1);
        params.append('billPayorInfo', 1);
        params.append('billAmount', amountInCents);
        params.append('billReturnUrl', returnUrl); 
        params.append('billCallbackUrl', 'https://reqres.in/api/users'); 
        params.append('billExternalReferenceNo', bookingId); 
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
                await updateDoc(doc(db, "bookings", bookingId), { billCode: billCode });
                window.location.href = `https://dev.toyyibpay.com/${billCode}`;
            } else {
                showToast("ToyyibPay Error", "error");
                fpxBtn.innerHTML = originalText;
                fpxBtn.disabled = false;
            }

        } catch (error) {
            console.error("Connection Error:", error);
            showToast("Network Error", "error");
            fpxBtn.innerHTML = originalText;
            fpxBtn.disabled = false;
        }
    });
}

async function checkReturnFromPayment() {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const billCode = urlParams.get('billcode');

    if (status === 'success' && bookingId) {
        if(loadingOverlay) loadingOverlay.classList.remove('hidden');
        try {
            const docRef = doc(db, "bookings", bookingId);
            await updateDoc(docRef, {
                status: 'confirmed',
                paymentMethod: 'toyyibpay',
                billCode: billCode || 'unknown',
                amountPaid: 50.00 // Mark that 50 was paid
            });
            showToast("Deposit Paid! Booking Confirmed.");
            setTimeout(() => window.location.href = 'customer-bookings.html', 1500);
        } catch (error) {
            console.error(error);
            showToast("Update failed", "error");
            if(loadingOverlay) loadingOverlay.classList.add('hidden');
        }
    }
}