import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const restaurantList = document.getElementById('restaurant-list');
const logoutBtn = document.getElementById('logout-btn');

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

// 3. Render Restaurants
async function loadRestaurants() {
    try {
        const querySnapshot = await getDocs(collection(db, "restaurants"));

        if (querySnapshot.empty) {
            restaurantList.innerHTML = `
                <div class="flex flex-col items-center justify-center h-64 text-slate-400">
                    <i data-lucide="store" class="w-12 h-12 mb-2 opacity-50"></i>
                    <p class="text-sm font-bold">No restaurants found.</p>
                </div>`;
            if(window.lucide) lucide.createIcons();
            return;
        }

        restaurantList.innerHTML = ''; 

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Random image fallback
            const randomImg = `https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600&q=80&random=${doc.id}`;
            
            // === NEW: Dynamic Rating Logic ===
            // Reads 'averageRating' from DB, defaults to "New" if missing
            const ratingDisplay = data.averageRating 
                ? parseFloat(data.averageRating).toFixed(1) 
                : 'New';
            
            const starColor = data.averageRating ? 'text-yellow-500 fill-yellow-500' : 'text-slate-300';

            const card = document.createElement('div');
            card.className = "group bg-white rounded-2xl p-3 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer";
            
            card.onclick = () => {
                window.location.href = `reservation.html?id=${doc.id}`;
            };

            card.innerHTML = `
                <div class="h-40 w-full rounded-xl overflow-hidden relative bg-slate-100 mb-3">
                    <img src="${data.imageUrl || randomImg}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                    <div class="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-bold text-slate-800 flex items-center gap-1 shadow-sm">
                        <i data-lucide="star" class="w-3 h-3 ${starColor}"></i> ${ratingDisplay}
                    </div>
                </div>

                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-bold text-slate-900 text-lg leading-tight">${data.name}</h3>
                        <p class="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <i data-lucide="map-pin" class="w-3 h-3"></i> ${data.address || 'Location N/A'}
                        </p>
                        <p class="text-[10px] text-slate-400 mt-2 font-medium bg-slate-50 inline-block px-2 py-1 rounded">
                            🕒 ${data.operatingHours || '10:00 AM - 10:00 PM'}
                        </p>
                    </div>
                    
                    <button class="bg-slate-900 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg group-hover:bg-teal-600 transition-colors">
                        <i data-lucide="arrow-right" class="w-5 h-5"></i>
                    </button>
                </div>
            `;
            
            restaurantList.appendChild(card);
        });

        if(window.lucide) lucide.createIcons();

    } catch (error) {
        console.error("Error loading restaurants:", error);
        restaurantList.innerHTML = '<p class="text-red-500 text-center text-sm font-bold mt-10">Error loading data.</p>';
    }
}