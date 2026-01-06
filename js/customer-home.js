import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const restaurantList = document.getElementById('restaurant-list');
const logoutBtn = document.getElementById('logout-btn');

// 1. Security Check: Redirect if not logged in
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'index.html'; // Kick back to login
    } else {
        // Only load data if user is logged in
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

// 3. Fetch and Display Restaurants
async function loadRestaurants() {
    restaurantList.innerHTML = ''; // Clear "Loading..." text

    try {
        const querySnapshot = await getDocs(collection(db, "restaurants"));

        if (querySnapshot.empty) {
            restaurantList.innerHTML = '<p>No restaurants found.</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Create HTML Card for each restaurant
            const card = document.createElement('div');
            card.classList.add('restaurant-card');
            
            // Note: We pass the ID, Name, Hours, and Capacity to the function
            card.innerHTML = `
                <h3>${data.name}</h3>
                <p class="address">📍 ${data.address}</p>
                <p class="hours">🕒 ${data.operatingHours}</p>
                <button onclick="window.location.href='booking-form.html?id=${doc.id}'">
                    Book Now
                </button>
            `;
            
            restaurantList.appendChild(card);
        });

    } catch (error) {
        console.error("Error loading restaurants:", error);
        restaurantList.innerHTML = '<p style="color:red">Error loading data.</p>';
    }
}