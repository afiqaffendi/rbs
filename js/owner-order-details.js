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

onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = 'index.html';
    else loadBookingDetails();
});

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

function renderDetails(data) {
    els.id.innerText = `ID: ${bookingId}`;
    els.customer.innerText = data.customerName || "Guest";
    els.date.innerText = data.bookingDate;
    els.time.innerText = data.timeSlot;
    els.pax.innerText = `${data.pax} People`;
    els.table.innerText = data.assignedTableSize ? `${data.assignedTableSize.replace('pax','')} Pax Table` : "Auto-Assigned";
    
    // Status Badge
    const status = data.status || 'pending';
    els.status.innerText = status.toUpperCase();
    if(status === 'confirmed') els.status.className = "px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-bold shadow-md";
    else if(status === 'completed') {
        els.status.className = "px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold";
        els.btnComplete.classList.add('hidden');
        els.btnCancel.classList.add('hidden');
    }
    else els.status.className = "px-4 py-2 bg-gray-400 text-white rounded-lg text-sm font-bold";

    // Menu Items
    els.menuList.innerHTML = '';
    let calculatedFoodTotal = 0;

    // Use 'menuItems' based on previous fixes
    const items = data.menuItems || []; 

    if (items.length > 0) {
        items.forEach(item => {
            const qty = parseInt(item.qty || item.quantity || 1);
            const price = parseFloat(item.price || 0);
            const itemTotal = price * qty;
            calculatedFoodTotal += itemTotal;
            
            els.menuList.innerHTML += `
                <div class="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <div class="flex items-center gap-3">
                        <span class="bg-slate-200 text-slate-700 text-xs font-bold w-6 h-6 flex items-center justify-center rounded">${qty}x</span>
                        <span class="text-sm font-medium text-slate-700">${item.name}</span>
                    </div>
                    <span class="text-sm font-bold text-slate-900">RM ${itemTotal.toFixed(2)}</span>
                </div>
            `;
        });
    } else {
        els.menuList.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-slate-400 text-sm italic"><i data-lucide="coffee" class="w-8 h-8 mb-2 opacity-50"></i>No pre-order items.</div>`;
    }

    // --- FINANCIAL SUMMARY (DEPOSIT LOGIC) ---
    const depositPaid = parseFloat(data.deposit || 50.00); 
    const foodCost = calculatedFoodTotal;
    // Total value of the "visit" is Food + Deposit? 
    // Or is the deposit PART of the food cost? 
    // Usually: Total Bill = Food. You pay 50 now. You pay (Food - 50) later.
    // If Food < 50, you usually don't get a refund, but let's assume Food > 50.
    
    const balanceDue = Math.max(0, foodCost - depositPaid);

    els.foodTotal.innerText = `RM ${foodCost.toFixed(2)}`;
    
    // We update the Grand Total element to show the BALANCE DUE, which is what the owner cares about collecting
    els.grandTotal.innerHTML = `
        <span class="text-xs text-slate-400 font-normal block">Total Food: RM ${foodCost.toFixed(2)}</span>
        <span class="text-xs text-green-500 font-normal block">Paid Deposit: - RM ${depositPaid.toFixed(2)}</span>
        <span class="text-xl text-red-600 font-bold block mt-1">Collect: RM ${balanceDue.toFixed(2)}</span>
    `;
    
    if(window.lucide) lucide.createIcons();
}

window.updateStatus = async (newStatus) => {
    if(!confirm(`Are you sure you want to mark this as ${newStatus}?`)) return;
    try {
        const docRef = doc(db, "bookings", bookingId);
        await updateDoc(docRef, { status: newStatus });
        alert("Status Updated!");
        location.reload(); 
    } catch (error) {
        console.error("Error updating:", error);
        alert("Failed to update status.");
    }
};