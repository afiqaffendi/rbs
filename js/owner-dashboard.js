import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM Elements
const pendingList = document.getElementById('pending-list');
const confirmedList = document.getElementById('confirmed-list');
const countPending = document.getElementById('count-pending');
const countConfirmed = document.getElementById('count-confirmed');
const logoutBtn = document.getElementById('logout-btn');

// Modal Elements
const modal = document.getElementById('verification-modal');
const modalReceipt = document.getElementById('modal-receipt');
const modalCustomer = document.getElementById('modal-customer');
const modalDetails = document.getElementById('modal-details');
const modalTotal = document.getElementById('modal-total');
const btnApprove = document.getElementById('btn-approve');
const btnReject = document.getElementById('btn-reject');

let currentOwnerId = null;
let currentBookingId = null; // Track which booking is open in modal

// 1. Initialization
document.addEventListener('DOMContentLoaded', () => {
    if(window.lucide) lucide.createIcons();
});

// 2. Auth Check
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        // Verify this is actually an Owner
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === 'Restaurant Owner') {
            currentOwnerId = user.uid;
            
            // To make this simple for the prototype, we assume the Owner ID 
            // is stored in the restaurant document. 
            // OR we just fetch ALL bookings for now (easier for demo).
            // In a real app, we'd filter: where("restaurantOwnerId", "==", user.uid)
            loadBookings(); 
        } else {
            alert("Access Denied: You are not a Restaurant Owner.");
            window.location.href = 'customer-home.html';
        }
    }
});

logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
});

// 3. Real-time Listeners (The "Magic" Part)
function loadBookings() {
    const q = collection(db, "bookings"); 
    
    // onSnapshot listens for live changes
    onSnapshot(q, (snapshot) => {
        pendingList.innerHTML = '';
        confirmedList.innerHTML = '';
        
        let pendingCount = 0;
        let confirmedCount = 0;

        if (snapshot.empty) {
            pendingList.innerHTML = '<p class="text-slate-400">No bookings found.</p>';
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            // Optional: Filter by specific restaurant ID if you had multiple
            
            const card = createBookingCard(doc.id, data);

            if (data.status === 'pending_verification') {
                pendingList.appendChild(card);
                pendingCount++;
            } else if (data.status === 'confirmed') {
                confirmedList.appendChild(card);
                confirmedCount++;
            }
        });

        countPending.innerText = pendingCount;
        countConfirmed.innerText = confirmedCount;
        if(window.lucide) lucide.createIcons();
    });
}

// 4. Helper: Create HTML Card
function createBookingCard(id, data) {
    const div = document.createElement('div');
    div.className = "bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition relative overflow-hidden group";
    
    // Status Badge Logic
    let statusColor = data.status === 'pending_verification' ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700';
    let statusText = data.status === 'pending_verification' ? 'Action Required' : 'Confirmed';

    div.innerHTML = `
        <div class="flex justify-between items-start mb-3">
            <span class="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${statusColor}">
                ${statusText}
            </span>
            <span class="text-xs font-bold text-slate-400">${data.bookingDate}</span>
        </div>

        <h3 class="font-bold text-slate-800 text-lg mb-1">Pax: ${data.pax} Guests</h3>
        <p class="text-sm text-slate-500 mb-4 flex items-center gap-2">
            <i data-lucide="clock" class="w-3 h-3"></i> ${data.timeSlot}
        </p>

        <div class="flex items-center justify-between mt-auto border-t border-slate-50 pt-3">
            <span class="font-bold text-slate-900">RM ${data.totalCost}</span>
            ${data.status === 'pending_verification' 
                ? `<button onclick="openVerifyModal('${id}', '${data.receiptUrl}', '${data.restaurantName}', 'RM ${data.totalCost}')" class="bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-teal-600 transition">Verify</button>` 
                : '<span class="text-teal-500"><i data-lucide="check" class="w-5 h-5"></i></span>'}
        </div>
    `;
    return div;
}

// 5. Modal Logic (Approve/Reject)
window.openVerifyModal = (id, receiptUrl, name, total) => {
    currentBookingId = id;
    modalReceipt.src = receiptUrl;
    modalCustomer.innerText = "Order Verification"; // You can fetch customer name if stored
    modalTotal.innerText = total;
    modal.classList.remove('hidden');
};

window.closeModal = () => {
    modal.classList.add('hidden');
    currentBookingId = null;
};

// Approve Action
btnApprove.addEventListener('click', async () => {
    if (!currentBookingId) return;
    
    btnApprove.innerText = "Processing...";
    try {
        const bookingRef = doc(db, "bookings", currentBookingId);
        await updateDoc(bookingRef, {
            status: "confirmed"
        });
        closeModal();
        btnApprove.innerText = "Approve Payment";
    } catch (error) {
        console.error("Error approving:", error);
        alert("Error updating status");
    }
});

// Reject Action
btnReject.addEventListener('click', async () => {
    if (!currentBookingId) return;

    if(confirm("Are you sure you want to reject this receipt?")) {
        try {
            const bookingRef = doc(db, "bookings", currentBookingId);
            await updateDoc(bookingRef, {
                status: "payment_rejected",
                rejectionTimestamp: Date.now() // For the 10-minute timer logic later
            });
            closeModal();
        } catch (error) {
            console.error("Error rejecting:", error);
        }
    }
});