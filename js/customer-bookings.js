import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const bookingsList = document.getElementById('bookings-list');

// 1. Auth Check
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        loadUserBookings(user.uid);
    }
});

// 2. Fetch Bookings
async function loadUserBookings(uid) {
    bookingsList.innerHTML = `
        <div class="animate-pulse space-y-4">
            <div class="h-32 bg-slate-200 rounded-2xl w-full"></div>
            <div class="h-32 bg-slate-200 rounded-2xl w-full"></div>
        </div>`;

    try {
        const q = query(
            collection(db, "bookings"),
            where("customerId", "==", uid)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            bookingsList.innerHTML = `
                <div class="flex flex-col items-center justify-center h-64 text-slate-400">
                    <i data-lucide="calendar-off" class="w-12 h-12 mb-3 opacity-50"></i>
                    <p class="text-sm font-bold">No bookings found.</p>
                    <a href="customer-home.html" class="mt-4 text-teal-600 text-xs font-bold bg-teal-50 px-4 py-2 rounded-lg">Make a reservation</a>
                </div>`;
            if(window.lucide) lucide.createIcons();
            return;
        }

        bookingsList.innerHTML = ''; 

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Determine Status Styling
            let statusBadge = '';
            let statusColor = '';
            
            if (data.status === 'pending_verification') {
                statusBadge = 'Pending';
                statusColor = 'bg-yellow-50 text-yellow-700 border-yellow-100';
            } else if (data.status === 'confirmed') {
                statusBadge = 'Confirmed';
                statusColor = 'bg-green-50 text-green-700 border-green-100';
            } else if (data.status === 'rejected') {
                statusBadge = 'Rejected';
                statusColor = 'bg-red-50 text-red-700 border-red-100';
            } else {
                statusBadge = 'Cancelled';
                statusColor = 'bg-slate-100 text-slate-500 border-slate-200';
            }

            // Create Tailwind Card
            const card = document.createElement('div');
            card.className = "bg-white p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 relative overflow-hidden transition-transform active:scale-[0.99]";

            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="font-bold text-slate-900 text-lg leading-tight">${data.restaurantName}</h3>
                        <p class="text-xs text-slate-400 flex items-center gap-1 mt-1">
                            <i data-lucide="receipt" class="w-3 h-3"></i> RM ${data.totalCost}
                        </p>
                    </div>
                    <span class="${statusColor} px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border">
                        ${statusBadge}
                    </span>
                </div>

                <div class="flex items-center gap-4 border-t border-slate-50 pt-4">
                    <div class="flex flex-col">
                        <span class="text-[10px] uppercase font-bold text-slate-400">Date</span>
                        <span class="text-sm font-bold text-slate-700">${data.bookingDate}</span>
                    </div>
                    <div class="w-px h-8 bg-slate-100"></div>
                    <div class="flex flex-col">
                        <span class="text-[10px] uppercase font-bold text-slate-400">Time</span>
                        <span class="text-sm font-bold text-slate-700">${data.timeSlot}</span>
                    </div>
                    <div class="w-px h-8 bg-slate-100"></div>
                    <div class="flex flex-col">
                        <span class="text-[10px] uppercase font-bold text-slate-400">Guests</span>
                        <span class="text-sm font-bold text-slate-700">${data.pax} Pax</span>
                    </div>
                </div>
            `;
            
            bookingsList.appendChild(card);
        });

        // Re-initialize icons for the new content
        if(window.lucide) lucide.createIcons();

    } catch (error) {
        console.error("Error loading bookings:", error);
        bookingsList.innerHTML = '<p class="text-red-500 text-center font-bold text-xs mt-10">Error loading data.</p>';
    }
}