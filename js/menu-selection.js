import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM Elements
const menuList = document.getElementById('menu-list');
const resNameHeader = document.getElementById('res-name-header');
const totalItemsDisplay = document.getElementById('total-items-display');
const totalCostDisplay = document.getElementById('total-cost-display');
const cartCountBadge = document.getElementById('cart-count-badge');
const confirmBtn = document.getElementById('confirm-menu-btn');
const backBtn = document.getElementById('back-btn');

// State
let restaurantId = new URLSearchParams(window.location.search).get('id');
let cart = {}; 
let menuItems = [];

// 1. Initialization
document.addEventListener('DOMContentLoaded', async () => {
    if (!restaurantId) {
        alert("No restaurant ID found.");
        window.location.href = 'customer-home.html';
        return;
    }
    loadDraftCart();
    await loadRestaurantMenu();
});

// 2. Load Menu
async function loadRestaurantMenu() {
    try {
        const docRef = doc(db, "restaurants", restaurantId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            resNameHeader.innerText = data.name;
            menuItems = data.menuItems || [];
            renderMenu();
            updateCartUI(); 
        } else {
            alert("Restaurant not found.");
        }
    } catch (error) {
        console.error("Error:", error);
        menuList.innerHTML = `<p class="text-center text-red-500">Failed to load menu.</p>`;
    }
}

// 3. Render Items
function renderMenu() {
    menuList.innerHTML = '';
    if (menuItems.length === 0) {
        menuList.innerHTML = `<p class="text-center text-slate-400 italic">No menu items available.</p>`;
        return;
    }

    menuItems.forEach((item) => {
        const itemId = item.name.replace(/\s+/g, '-').toLowerCase();
        const currentQty = cart[itemId]?.qty || 0;

        const itemEl = document.createElement('div');
        itemEl.className = "bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center";
        
        itemEl.innerHTML = `
            <div class="flex-1 pr-4">
                <h3 class="font-bold text-slate-900 text-sm">${item.name}</h3>
                <p class="text-teal-600 font-bold text-sm mt-1">RM ${parseFloat(item.price).toFixed(2)}</p>
            </div>
            <div class="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200">
                <button class="w-8 h-8 flex items-center justify-center text-slate-500 font-bold text-lg" 
                    onclick="updateItemQty('${itemId}', '${item.name}', ${item.price}, -1)">-</button>
                <span id="qty-${itemId}" class="w-8 text-center font-bold text-sm text-slate-900">${currentQty}</span>
                <button class="w-8 h-8 flex items-center justify-center text-slate-900 font-bold text-lg" 
                    onclick="updateItemQty('${itemId}', '${item.name}', ${item.price}, 1)">+</button>
            </div>
        `;
        menuList.appendChild(itemEl);
    });
}

// 4. Cart Logic (Must be global)
window.updateItemQty = (id, name, price, change) => {
    if (!cart[id]) cart[id] = { name, price, qty: 0 };
    cart[id].qty += change;
    if (cart[id].qty <= 0) {
        delete cart[id];
        document.getElementById(`qty-${id}`).innerText = "0";
    } else {
        document.getElementById(`qty-${id}`).innerText = cart[id].qty;
    }
    updateCartUI();
    saveDraftCart();
};

function updateCartUI() {
    let totalQty = 0;
    let totalCost = 0;
    Object.values(cart).forEach(item => {
        totalQty += item.qty;
        totalCost += (item.qty * item.price);
    });

    totalItemsDisplay.innerText = `${totalQty} Selected`;
    totalCostDisplay.innerText = `RM ${totalCost.toFixed(2)}`;
    
    if (totalQty > 0) {
        cartCountBadge.classList.remove('hidden');
        cartCountBadge.innerText = totalQty;
    } else {
        cartCountBadge.classList.add('hidden');
    }
}

// 5. Session Storage (Pass data between pages)
function saveDraftCart() {
    const draft = JSON.parse(sessionStorage.getItem('dtebs_booking_draft') || '{}');
    draft.cart = cart;
    draft.restaurantId = restaurantId;
    sessionStorage.setItem('dtebs_booking_draft', JSON.stringify(draft));
}

function loadDraftCart() {
    const draft = JSON.parse(sessionStorage.getItem('dtebs_booking_draft') || '{}');
    if (draft.restaurantId === restaurantId && draft.cart) {
        cart = draft.cart;
    }
}

// 6. Navigation
backBtn.onclick = () => {
    saveDraftCart();
    window.location.href = `reservation.html?id=${restaurantId}`;
};

confirmBtn.onclick = () => {
    saveDraftCart();
    window.location.href = `reservation.html?id=${restaurantId}`;
};