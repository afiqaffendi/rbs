import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const restaurantList = document.getElementById('restaurant-list');
const logoutBtn = document.getElementById('logout-btn');
const searchInput = document.getElementById('search-input');

// Modal Elements
const reviewsModal = document.getElementById('reviews-modal');
const reviewsModalTitle = document.getElementById('reviews-modal-title');
const reviewsModalContent = document.getElementById('reviews-modal-content');

let allRestaurants = [];

// 1. Auth Check
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        loadRestaurants();
    }
});

// 2. Logout Logic
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Logout Error:", error);
    }
});

// 3. Load Data
async function loadRestaurants() {
    try {
        const querySnapshot = await getDocs(collection(db, "restaurants"));
        allRestaurants = [];
        querySnapshot.forEach((doc) => {
            allRestaurants.push({ id: doc.id, ...doc.data() });
        });
        renderList(allRestaurants);
    } catch (error) {
        console.error("Error loading restaurants:", error);
        restaurantList.innerHTML = '<p class="text-red-500 text-center text-sm font-bold mt-10">Error loading data.</p>';
    }
}

// 4. Search Logic
if(searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allRestaurants.filter(r => {
            const name = (r.name || '').toLowerCase();
            const address = (r.address || '').toLowerCase();
            return name.includes(term) || address.includes(term);
        });
        renderList(filtered);
    });
}

// 5. Render Function
function renderList(data) {
    restaurantList.innerHTML = ''; 

    if (data.length === 0) {
        restaurantList.innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 text-slate-400">
                <i data-lucide="search-x" class="w-12 h-12 mb-2 opacity-50"></i>
                <p class="text-sm font-bold">No restaurants found.</p>
            </div>`;
        if(window.lucide) lucide.createIcons();
        return;
    }

    data.forEach(item => {
        const randomImg = `https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600&q=80&random=${item.id}`;
        
        const ratingDisplay = item.averageRating ? parseFloat(item.averageRating).toFixed(1) : 'New';
        const starColor = item.averageRating ? 'text-yellow-500 fill-yellow-500' : 'text-slate-300';

        const card = document.createElement('div');
        card.className = "group bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer relative";
        
        // Main Click: Go to Reservation
        card.onclick = () => {
            window.location.href = `reservation.html?id=${item.id}`;
        };

        card.innerHTML = `
            <div class="h-40 w-full rounded-xl overflow-hidden relative bg-slate-100 mb-3">
                <img src="${item.imageUrl || randomImg}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                <div class="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-bold text-slate-800 flex items-center gap-1 shadow-sm">
                    <i data-lucide="star" class="w-3 h-3 ${starColor}"></i> ${ratingDisplay}
                </div>
            </div>

            <div class="flex flex-col gap-1">
                <h3 class="font-bold text-slate-900 text-lg leading-tight">${item.name}</h3>
                
                <p class="text-xs text-slate-500 flex items-center gap-1">
                    <i data-lucide="map-pin" class="w-3 h-3 text-slate-400"></i> ${item.address || 'Location N/A'}
                </p>
                
                <p class="text-[10px] text-slate-400 font-medium bg-slate-50 inline-block px-2 py-1 rounded self-start mt-1 border border-slate-100">
                    Operating Hours: ${item.operatingHours || '10:00 AM - 10:00 PM'}
                </p>

                <button onclick="event.stopPropagation(); openReviewsModal('${item.id}', '${item.name}')" 
                    class="mt-3 w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 hover:text-slate-900 transition flex items-center justify-center gap-2">
                    <i data-lucide="message-square" class="w-3 h-3"></i> See Customer Reviews
                </button>
            </div>
        `;
        
        restaurantList.appendChild(card);
    });

    if(window.lucide) lucide.createIcons();
}

// --- NEW: Review Modal Logic ---

// Make globally accessible for HTML onclick
window.openReviewsModal = async (id, name) => {
    reviewsModal.classList.remove('hidden');
    reviewsModalTitle.innerText = name;
    
    // Show Loading State
    reviewsModalContent.innerHTML = `
        <div class="flex flex-col items-center justify-center h-40 text-slate-400">
            <i data-lucide="loader-2" class="w-8 h-8 animate-spin mb-2 text-teal-600"></i>
            <p class="text-xs font-bold">Loading reviews...</p>
        </div>`;
    if(window.lucide) lucide.createIcons();

    try {
        const q = query(collection(db, "reviews"), where("restaurantId", "==", id));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            reviewsModalContent.innerHTML = `
                <div class="flex flex-col items-center justify-center h-48 text-slate-400">
                    <div class="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                        <i data-lucide="message-square-off" class="w-6 h-6 opacity-50"></i>
                    </div>
                    <p class="text-sm font-bold text-slate-500">No reviews yet</p>
                    <p class="text-xs">Be the first to review after booking!</p>
                </div>`;
            if(window.lucide) lucide.createIcons();
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            let stars = '';
            for(let i=0; i<5; i++) {
                stars += `<i data-lucide="star" class="w-3 h-3 ${i < data.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}"></i>`;
            }
            
            const dateStr = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'Recently';

            html += `
                <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex items-center gap-1">${stars}</div>
                        <span class="text-[10px] text-slate-400 font-medium">${dateStr}</span>
                    </div>
                    <p class="text-sm text-slate-700 leading-relaxed">"${data.comment}"</p>
                </div>
            `;
        });
        
        reviewsModalContent.innerHTML = html;
        if(window.lucide) lucide.createIcons();

    } catch (e) {
        console.error(e);
        reviewsModalContent.innerHTML = '<p class="text-center text-red-500 text-sm mt-4">Failed to load reviews.</p>';
    }
};

window.closeReviewsModal = () => {
    reviewsModal.classList.add('hidden');
};