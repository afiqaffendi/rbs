import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const menuList = document.getElementById('menu-list');
const form = document.getElementById('menu-form');
let restaurantId = null;

// 1. Auth & Load
onAuthStateChanged(auth, async (user) => {
    if (user) {
        await loadRestaurant(user.uid);
    }
});

async function loadRestaurant(uid) {
    const q = query(collection(db, "restaurants"), where("ownerId", "==", uid));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
        restaurantId = querySnapshot.docs[0].id;
        renderMenu(querySnapshot.docs[0].data().menuItems || []);
    } else {
        alert("Please set up your Restaurant Profile first.");
        window.location.href = 'owner-profile.html';
    }
}

function renderMenu(items) {
    menuList.innerHTML = '';
    if (items.length === 0) {
        menuList.innerHTML = '<div class="bg-white p-6 rounded-xl text-center text-slate-400">No items added yet.</div>';
        return;
    }

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = "bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center";
        div.innerHTML = `
            <div>
                <h3 class="font-bold text-slate-900">${item.name}</h3>
                <p class="text-teal-600 font-bold">RM ${parseFloat(item.price).toFixed(2)}</p>
            </div>
            <button class="delete-btn text-red-500 bg-red-50 p-2 rounded-lg hover:bg-red-100 transition" data-name="${item.name}">
                <i data-lucide="trash-2" class="w-5 h-5"></i>
            </button>
        `;
        // Attach delete event
        div.querySelector('.delete-btn').addEventListener('click', () => deleteItem(item));
        menuList.appendChild(div);
    });
    if(window.lucide) lucide.createIcons();
}

// 2. Add Item
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!restaurantId) return;

    const newItem = {
        name: document.getElementById('item-name').value,
        price: parseFloat(document.getElementById('item-price').value)
    };

    try {
        await updateDoc(doc(db, "restaurants", restaurantId), {
            menuItems: arrayUnion(newItem)
        });
        // Reload page to refresh (simplest way to sync)
        location.reload(); 
    } catch (error) {
        console.error(error);
        alert("Error adding item");
    }
});

// 3. Delete Item
async function deleteItem(item) {
    if(!confirm(`Remove ${item.name} from menu?`)) return;
    try {
        await updateDoc(doc(db, "restaurants", restaurantId), {
            menuItems: arrayRemove(item)
        });
        location.reload();
    } catch (error) {
        console.error(error);
        alert("Error deleting item");
    }
}