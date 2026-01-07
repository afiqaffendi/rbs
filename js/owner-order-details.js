import { db, auth } from './firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Get ID from URL
const urlParams = new URLSearchParams(window.location.search);
const bookingId = urlParams.get('id');

// DOM Elements
const els = {
    id: document.getElementById('order-id'),
    status: document.getElementById('status-badge'),
    customer: document.getElementById('customer-name'),
    date: document.getElementById('booking-date'),
    time: document.getElementById('booking-time'),
    table: document.getElementById('table-info'),
    pax: document.getElementById('pax-count'),
    menuList: document.getElementById('menu-items-container'),
    foodTotal: document.getElementById('food-total'),
    grandTotal: document.getElementById('grand-total'),
    btnComplete: document.getElementById('btn-complete'),
    btnCancel: document.getElementById('btn-cancel')
};

// 1. Auth Check
onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = 'index.html';
    else loadBookingDetails();
});

// 2. Fetch Data
async function loadBookingDetails() {
    if (!bookingId) {
        alert("No Booking ID found.");
        window.location.href = 'owner-dashboard.html';
        return;
    }

    try {
        const docRef = doc(db, "bookings", bookingId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            renderDetails(docSnap.data());
        } else {
            alert("Booking not found!");
            window.location.href = 'owner-dashboard.html';
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

// 3. Render Data
function renderDetails(data) {
    els.id.innerText = `ID: ${bookingId}`;
    els.customer.innerText = data.customerName || "Guest";
    els.date.innerText = data.bookingDate;
    els.time.innerText = data.timeSlot;
    els.pax.innerText = `${data.pax} People`;
    els.table.innerText = data.assignedTableSize ? `${data.assignedTableSize.replace('pax','')} Pax Table` : "Auto-Assigned";
    
    // Status Badge Logic
    const status = data.status || 'pending';
    els.status.innerText = status.toUpperCase();
    if(status === 'confirmed') els.status.className = "px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-bold shadow-md";
    else if(status === 'completed') {
        els.status.className = "px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold";
        els.btnComplete.classList.add('hidden'); // Hide button if already done
        els.btnCancel.classList.add('hidden');
    }
    else els.status.className = "px-4 py-2 bg-gray-400 text-white rounded-lg text-sm font-bold";

    // Menu Items
    els.menuList.innerHTML = '';
    let calculatedFoodTotal = 0;

    if (data.menuItems && data.menuItems.length > 0) {
        data.menuItems.forEach(item => {
            const itemTotal = item.price * item.qty;
            calculatedFoodTotal += itemTotal;
            
            els.menuList.innerHTML += `
                <div class="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <div class="flex items-center gap-3">
                        <span class="bg-slate-200 text-slate-700 text-xs font-bold w-6 h-6 flex items-center justify-center rounded">${item.qty}x</span>
                        <span class="text-sm font-medium text-slate-700">${item.name}</span>
                    </div>
                    <span class="text-sm font-bold text-slate-900">RM ${itemTotal.toFixed(2)}</span>
                </div>
            `;
        });
    } else {
        els.menuList.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-slate-400 text-sm italic"><i data-lucide="coffee" class="w-8 h-8 mb-2 opacity-50"></i>No pre-order items.</div>`;
    }

    // Money
    els.foodTotal.innerText = `RM ${calculatedFoodTotal.toFixed(2)}`;
    els.grandTotal.innerText = `RM ${(calculatedFoodTotal + 50).toFixed(2)}`;
    
    lucide.createIcons();
}

// 4. Update Status Function
window.updateStatus = async (newStatus) => {
    if(!confirm(`Are you sure you want to mark this as ${newStatus}?`)) return;
    
    try {
        const docRef = doc(db, "bookings", bookingId);
        await updateDoc(docRef, { status: newStatus });
        alert("Status Updated!");
        location.reload(); // Refresh page to see changes
    } catch (error) {
        console.error("Error updating:", error);
        alert("Failed to update status.");
    }
};