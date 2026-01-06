import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const bookingsList = document.getElementById('bookings-list');
const logoutBtn = document.getElementById('logout-btn');

// 1. Auth Check
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        loadUserBookings(user.uid);
    }
});

// 2. Logout Logic
logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = 'index.html';
});

// 3. Fetch Bookings
async function loadUserBookings(uid) {
    bookingsList.innerHTML = '<p>Loading...</p>';

    try {
        // Query: Get bookings where customerId == Current User
        const q = query(
            collection(db, "bookings"),
            where("customerId", "==", uid)
            // Note: If you want sorting, you might need a Firestore Index. 
            // For now, we will sort in Javascript to avoid errors.
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            bookingsList.innerHTML = '<p>You have no bookings yet.</p>';
            return;
        }

        bookingsList.innerHTML = ''; // Clear loading text

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const bookingId = doc.id;
            
            // Create the Card HTML
            const card = document.createElement('div');
            card.classList.add('booking-card');
            
            // Determine Status Color & Text
            let statusBadge = '';
            let actionButtons = '';

            if (data.status === 'pending_verification') {
                statusBadge = '<span class="badge badge-yellow">⏳ Waiting for Confirmation</span>';
            } else if (data.status === 'confirmed') {
                statusBadge = '<span class="badge badge-green">✅ Confirmed</span>';
            } else if (data.status === 'rejected' || data.status === 'payment_rejected') {
                statusBadge = '<span class="badge badge-red">❌ Payment Rejected</span>';
                // We will add the "Re-upload" logic here later
                actionButtons = `<button class="btn-small" onclick="alert('Re-upload feature coming soon!')">Re-upload Receipt</button>`;
            } else {
                 statusBadge = '<span class="badge badge-gray">Cancelled</span>';
            }

            card.innerHTML = `
                <div class="card-header">
                    <h3>${data.restaurantName}</h3>
                    ${statusBadge}
                </div>
                <div class="card-body">
                    <p><strong>Date:</strong> ${data.bookingDate}</p>
                    <p><strong>Time:</strong> ${data.timeSlot}</p>
                    <p><strong>Pax:</strong> ${data.pax} people</p>
                    <p><strong>Total:</strong> RM ${data.totalCost}</p>
                </div>
                <div class="card-actions">
                   ${actionButtons}
                </div>
            `;
            
            bookingsList.appendChild(card);
        });

    } catch (error) {
        console.error("Error loading bookings:", error);
        bookingsList.innerHTML = '<p style="color:red">Error loading bookings.</p>';
    }
}