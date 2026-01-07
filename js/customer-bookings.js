import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, updateDoc, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM Elements
const bookingsList = document.getElementById('bookings-list');
const btnUpcoming = document.getElementById('btn-upcoming');
const btnHistory = document.getElementById('btn-history');

// Modal Elements
const reviewModal = document.getElementById('review-modal');
const reviewResName = document.getElementById('review-res-name');
const reviewComment = document.getElementById('review-comment');
const submitReviewBtn = document.getElementById('submit-review-btn');

// State Variables
let allBookings = [];
let currentView = 'upcoming'; 
let selectedRating = 0;
let currentReviewBookingId = null;
let currentReviewRestaurantId = null;

// 1. Auth Check
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        loadUserBookings(user.uid);
    }
});

// 2. Fetch & Process Bookings
async function loadUserBookings(uid) {
    bookingsList.innerHTML = `
        <div class="animate-pulse space-y-4">
            <div class="h-32 bg-slate-200 rounded-2xl w-full"></div>
            <div class="h-32 bg-slate-200 rounded-2xl w-full"></div>
        </div>`;

    try {
        const q = query(collection(db, "bookings"), where("customerId", "==", uid));
        const querySnapshot = await getDocs(q);
        
        allBookings = [];
        querySnapshot.forEach((doc) => {
            allBookings.push({ id: doc.id, ...doc.data() });
        });

        // Sort: Newest First
        allBookings.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.seconds : 0;
            const timeB = b.createdAt ? b.createdAt.seconds : 0;
            return timeB - timeA;
        });

        renderBookings();

    } catch (error) {
        console.error("Error loading bookings:", error);
        bookingsList.innerHTML = `<p class="text-red-500 text-center font-bold text-xs mt-10">Error: ${error.message}</p>`;
    }
}

// 3. Render Logic
function renderBookings() {
    bookingsList.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];

    const filtered = allBookings.filter(b => {
        if (currentView === 'upcoming') {
            return b.bookingDate >= today && 
                   ['confirmed', 'pending_payment', 'pending_verification'].includes(b.status);
        } else {
            return b.bookingDate < today || 
                   ['completed', 'cancelled', 'rejected'].includes(b.status);
        }
    });

    if (filtered.length === 0) {
        bookingsList.innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 text-slate-400">
                <i data-lucide="${currentView === 'upcoming' ? 'calendar' : 'history'}" class="w-12 h-12 mb-3 opacity-50"></i>
                <p class="text-sm font-bold">No ${currentView} bookings found.</p>
                ${currentView === 'upcoming' ? '<a href="customer-home.html" class="mt-4 text-teal-600 text-xs font-bold bg-teal-50 px-4 py-2 rounded-lg">Make a reservation</a>' : ''}
            </div>`;
        if(window.lucide) lucide.createIcons();
        return;
    }

    filtered.forEach(data => {
        let statusBadge = '';
        let statusColor = '';

        if (data.status === 'completed') {
            statusBadge = 'Completed';
            statusColor = 'bg-teal-50 text-teal-700 border-teal-100'; 
        } else if (data.status === 'confirmed') {
            statusBadge = 'Confirmed';
            statusColor = 'bg-green-50 text-green-700 border-green-100';
        } else if (data.status === 'pending_verification' || data.status === 'pending_payment') {
            statusBadge = 'Pending';
            statusColor = 'bg-yellow-50 text-yellow-700 border-yellow-100';
        } else if (data.status === 'rejected') {
            statusBadge = 'Rejected';
            statusColor = 'bg-red-50 text-red-700 border-red-100';
        } else {
            statusBadge = 'Cancelled';
            statusColor = 'bg-slate-100 text-slate-500 border-slate-200';
        }

        const card = document.createElement('div');
        card.className = "bg-white p-5 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100 relative overflow-hidden";

        let actionBtn = '';

        if (currentView === 'upcoming' && ['confirmed', 'pending_payment'].includes(data.status)) {
            actionBtn = `
                <button onclick="handleCancel('${data.id}')" class="w-full mt-4 py-3 rounded-xl border border-red-100 text-red-600 font-bold text-xs bg-red-50 hover:bg-red-100 transition">
                    Cancel Reservation
                </button>`;
        }
        
        if (data.status === 'completed' && !data.isReviewed) {
            actionBtn = `
                <button onclick="openReviewModal('${data.id}', '${data.restaurantName}', '${data.restaurantId}')" class="w-full mt-4 py-3 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-black transition flex justify-center items-center gap-2">
                    <i data-lucide="star" class="w-3 h-3"></i> Rate Experience
                </button>`;
        } else if (data.status === 'completed' && data.isReviewed) {
             actionBtn = `
                <div class="mt-4 py-3 rounded-xl bg-slate-50 text-slate-400 font-bold text-xs text-center flex justify-center items-center gap-1">
                    <i data-lucide="check-circle" class="w-3 h-3"></i> Reviewed
                </div>`;
        }

        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="font-bold text-slate-900 text-lg leading-tight">${data.restaurantName}</h3>
                    <p class="text-xs text-slate-400 flex items-center gap-1 mt-1">
                        <i data-lucide="receipt" class="w-3 h-3"></i> RM ${parseFloat(data.totalCost || 0).toFixed(2)}
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
            ${actionBtn}
        `;
        bookingsList.appendChild(card);
    });

    if(window.lucide) lucide.createIcons();
}

window.handleCancel = async (bookingId) => {
    if(!confirm("Are you sure you want to cancel?")) return;
    try {
        await updateDoc(doc(db, "bookings", bookingId), { status: 'cancelled' });
        const item = allBookings.find(b => b.id === bookingId);
        if(item) item.status = 'cancelled';
        renderBookings(); 
        alert("Booking cancelled.");
    } catch (error) {
        console.error(error);
        alert("Error cancelling booking.");
    }
};

window.openReviewModal = (bookingId, resName, resId) => {
    currentReviewBookingId = bookingId;
    currentReviewRestaurantId = resId;
    reviewResName.innerText = resName;
    reviewModal.classList.remove('hidden');
    selectedRating = 0;
    updateStars();
};

window.closeReviewModal = () => {
    reviewModal.classList.add('hidden');
};

window.setRating = (rating) => {
    selectedRating = rating;
    updateStars();
};

function updateStars() {
    const stars = document.querySelectorAll('.star-btn svg');
    stars.forEach((star, index) => {
        if (index < selectedRating) {
            star.classList.add('fill-yellow-400', 'text-yellow-400');
            star.classList.remove('text-slate-300');
        } else {
            star.classList.remove('fill-yellow-400', 'text-yellow-400');
            star.classList.add('text-slate-300');
        }
    });
}

// === MAIN UPDATE: Calculate & Save New Average ===
window.submitReview = async () => {
    if (selectedRating === 0) {
        alert("Please select a star rating.");
        return;
    }

    submitReviewBtn.innerText = "Submitting...";
    submitReviewBtn.disabled = true;

    try {
        // 1. Save the new Review
        await addDoc(collection(db, "reviews"), {
            restaurantId: currentReviewRestaurantId,
            bookingId: currentReviewBookingId,
            rating: selectedRating,
            comment: reviewComment.value,
            createdAt: Timestamp.now()
        });

        // 2. Mark Booking as Reviewed
        await updateDoc(doc(db, "bookings", currentReviewBookingId), {
            isReviewed: true
        });

        // 3. NEW: Recalculate Average Rating for Restaurant
        // Fetch all reviews for this restaurant to calculate true average
        const q = query(collection(db, "reviews"), where("restaurantId", "==", currentReviewRestaurantId));
        const querySnapshot = await getDocs(q);
        
        let totalStars = 0;
        let reviewCount = 0;
        
        querySnapshot.forEach(doc => {
            const r = doc.data();
            totalStars += r.rating;
            reviewCount++;
        });

        const newAverage = reviewCount > 0 ? (totalStars / reviewCount) : 0;

        // Save the new average to the Restaurant document
        await updateDoc(doc(db, "restaurants", currentReviewRestaurantId), {
            averageRating: newAverage,
            reviewCount: reviewCount
        });

        // 4. Update Local UI
        const item = allBookings.find(b => b.id === currentReviewBookingId);
        if(item) item.isReviewed = true;

        alert("Review submitted! Thank you.");
        closeReviewModal();
        renderBookings();

    } catch (error) {
        console.error("Review Error:", error);
        alert("Failed to submit review: " + error.message);
    } finally {
        submitReviewBtn.innerText = "Submit Review";
        submitReviewBtn.disabled = false;
    }
};

function updateTabs(view) {
    currentView = view;
    const activeClass = ['bg-slate-900', 'text-white', 'shadow-md'];
    const inactiveClass = ['bg-slate-50', 'text-slate-500', 'border', 'border-slate-100'];

    if (view === 'upcoming') {
        btnUpcoming.classList.add(...activeClass);
        btnUpcoming.classList.remove(...inactiveClass);
        btnHistory.classList.add(...inactiveClass);
        btnHistory.classList.remove(...activeClass);
    } else {
        btnHistory.classList.add(...activeClass);
        btnHistory.classList.remove(...inactiveClass);
        btnUpcoming.classList.add(...inactiveClass);
        btnUpcoming.classList.remove(...activeClass);
    }
    renderBookings();
}

btnUpcoming.addEventListener('click', () => updateTabs('upcoming'));
btnHistory.addEventListener('click', () => updateTabs('history'));