import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM Elements
const bookingsList = document.getElementById('bookings-list');
const emptyState = document.getElementById('empty-state');
const logoutBtn = document.getElementById('logout-btn');
const statToday = document.getElementById('stat-today');
const statPending = document.getElementById('stat-pending');
const statRevenue = document.getElementById('stat-revenue');

// Filter Elements
const filterDateInput = document.getElementById('filter-date');
const btnShowAll = document.getElementById('btn-show-all');

// Modal Elements
const modal = document.getElementById('verify-modal');
const modalRef = document.getElementById('modal-ref');
const btnApprove = document.getElementById('btn-approve');
const btnReject = document.getElementById('btn-reject');
const closeModal = document.getElementById('close-modal');

// State
let currentListener = null; // To hold the unsubscribe function
let selectedBookingId = null;

// 1. Auth Check
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html'; // Protect the page
    } else {
        // Default: Show Today's bookings
        const today = new Date().toISOString().split('T')[0];
        filterDateInput.value = today;
        setupRealtimeListener(today);
    }
});

// 2. Real-Time Listener Setup
function setupRealtimeListener(dateFilter = null) {
    // A. Unsubscribe from previous listener if exists
    if (currentListener) {
        currentListener(); 
    }

    bookingsList.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-400">Loading data...</td></tr>';

    // B. Build Query
    let q;
    const bookingsRef = collection(db, "bookings");

    if (dateFilter) {
        // Filter by specific date
        q = query(bookingsRef, where("bookingDate", "==", dateFilter));
    } else {
        // Show All (Limit to 50 for performance)
        // Note: orderBy requires an index. If this fails, remove orderBy.
        q = query(bookingsRef); 
    }

    // C. Start Listening
    currentListener = onSnapshot(q, (snapshot) => {
        let rowsHtml = '';
        let todayCount = 0;
        let pendingCount = 0;
        let revenue = 0;

        if (snapshot.empty) {
            bookingsList.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        // Convert to array to sort client-side (avoids index issues)
        let bookings = [];
        snapshot.forEach(doc => {
            bookings.push({ id: doc.id, ...doc.data() });
        });

        // Client-side Sort: Newest First
        bookings.sort((a, b) => {
             const tA = a.createdAt ? a.createdAt.seconds : 0;
             const tB = b.createdAt ? b.createdAt.seconds : 0;
             return tB - tA;
        });

        // Loop and Build HTML
        bookings.forEach(data => {
            // Update Stats
            if (data.status === 'confirmed') revenue += parseFloat(data.totalCost || 0);
            if (data.status === 'pending_verification' || data.status === 'pending_payment') pendingCount++;
            
            // Just a rough check for "Today" stat regardless of filter
            const today = new Date().toISOString().split('T')[0];
            if (data.bookingDate === today) todayCount++;

            // Badge Logic
            let badgeClass = 'bg-slate-100 text-slate-500';
            if (data.status === 'confirmed') badgeClass = 'bg-green-100 text-green-700 border-green-200';
            if (data.status.includes('pending')) badgeClass = 'bg-yellow-100 text-yellow-700 border-yellow-200';
            if (data.status === 'rejected') badgeClass = 'bg-red-100 text-red-700 border-red-200';

            rowsHtml += `
                <tr class="hover:bg-slate-50 transition">
                    <td class="px-6 py-4 font-bold text-slate-800">
                        Guest
                    </td>
                    <td class="px-6 py-4 text-slate-600">
                        <div class="font-bold">${data.bookingDate}</div>
                        <div class="text-xs opacity-70">${data.timeSlot}</div>
                    </td>
                    <td class="px-6 py-4 text-slate-600">${data.pax}</td>
                    <td class="px-6 py-4 font-mono text-xs">
                        <span class="block font-bold">RM ${parseFloat(data.totalCost || 0).toFixed(2)}</span>
                        <span class="text-teal-600">${data.paymentMethod || 'Manual'}</span>
                    </td>
                    <td class="px-6 py-4">
                        <span class="${badgeClass} px-2 py-1 rounded-full text-xs font-bold border capitalize">
                            ${data.status.replace('_', ' ')}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-right">
                        <button onclick="openVerifyModal('${data.id}', '${data.billCode || data.paymentRef || 'N/A'}')" 
                            class="text-slate-400 hover:text-slate-900 p-2 rounded-full hover:bg-slate-200 transition">
                            <i data-lucide="more-horizontal" class="w-5 h-5"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        bookingsList.innerHTML = rowsHtml;
        
        // Update Stats UI
        statToday.innerText = todayCount;
        statPending.innerText = pendingCount;
        statRevenue.innerText = `RM ${revenue.toFixed(0)}`;
        
        // Refresh icons
        if(window.lucide) lucide.createIcons();
    }, (error) => {
        console.error("Snapshot Error:", error);
        bookingsList.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-500">Error: ${error.message}</td></tr>`;
    });
}

// 3. Filter Event Listeners
filterDateInput.addEventListener('change', (e) => {
    setupRealtimeListener(e.target.value);
});

btnShowAll.addEventListener('click', () => {
    filterDateInput.value = ''; // Clear picker
    setupRealtimeListener(null); // Load all
});

// 4. Modal & Actions Logic
window.openVerifyModal = (id, ref) => {
    selectedBookingId = id;
    modalRef.innerText = ref;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

const hideModal = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    selectedBookingId = null;
};

closeModal.onclick = hideModal;
btnApprove.onclick = () => updateStatus('confirmed');
btnReject.onclick = () => updateStatus('rejected');

async function updateStatus(newStatus) {
    if (!selectedBookingId) return;
    
    // UI Feedback
    const oldText = newStatus === 'confirmed' ? btnApprove.innerText : btnReject.innerText;
    if(newStatus === 'confirmed') btnApprove.innerText = "..."; 
    else btnReject.innerText = "...";

    try {
        const docRef = doc(db, "bookings", selectedBookingId);
        await updateDoc(docRef, { status: newStatus });
        
        // Note: No need to reload! onSnapshot will update the row automatically.
        hideModal();

    } catch (error) {
        console.error("Update Error:", error);
        alert("Failed to update: " + error.message);
    } finally {
        // Reset buttons
        btnApprove.innerText = "Approve";
        btnReject.innerText = "Reject";
    }
}

// 5. Logout
logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'index.html');
});