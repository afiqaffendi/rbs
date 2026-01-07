import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const menuList = document.getElementById('menu-list');
const galleryList = document.getElementById('gallery-list');
const menuForm = document.getElementById('menu-form');
const imageForm = document.getElementById('image-form');

let restaurantId = null;

// 1. Auth & Load
onAuthStateChanged(auth, async (user) => {
    if (user) {
        await loadRestaurant(user.uid);
    } else {
        window.location.href = 'index.html';
    }
});

async function loadRestaurant(uid) {
    const q = query(collection(db, "restaurants"), where("ownerId", "==", uid));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
        restaurantId = querySnapshot.docs[0].id;
        const data = querySnapshot.docs[0].data();
        renderMenu(data.menuItems || []);
        renderGallery(data.menuImages || []);
    } else {
        alert("Please set up your Restaurant Profile first.");
        window.location.href = 'owner-profile.html';
    }
}

// --- PART A: FOOD ITEMS ---
function renderMenu(items) {
    menuList.innerHTML = '';
    if (items.length === 0) {
        menuList.innerHTML = '<div class="text-center text-slate-400 text-sm italic">No food items added yet.</div>';
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
            <button class="delete-item-btn text-red-500 bg-red-50 p-2 rounded-lg hover:bg-red-100 transition">
                <i data-lucide="trash-2" class="w-5 h-5"></i>
            </button>
        `;
        div.querySelector('.delete-item-btn').addEventListener('click', () => deleteFoodItem(item));
        menuList.appendChild(div);
    });
    if(window.lucide) lucide.createIcons();
}

menuForm.addEventListener('submit', async (e) => {
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
        location.reload(); 
    } catch (error) {
        console.error(error);
        alert("Error adding item");
    }
});

async function deleteFoodItem(item) {
    if(!confirm(`Remove ${item.name}?`)) return;
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

// --- PART B: MENU IMAGES (LINKS) ---
function renderGallery(images) {
    galleryList.innerHTML = '';
    if (images.length === 0) {
        galleryList.innerHTML = '<p class="col-span-3 text-center text-slate-400 text-sm italic py-4">No images added yet.</p>';
        return;
    }

    images.forEach(url => {
        const div = document.createElement('div');
        div.className = "relative group h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-100";
        div.innerHTML = `
            <img src="${url}" class="w-full h-full object-cover">
            <button class="delete-img-btn absolute top-1 right-1 bg-red-500 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition shadow-md">
                <i data-lucide="x" class="w-3 h-3"></i>
            </button>
        `;
        div.querySelector('.delete-img-btn').addEventListener('click', () => deleteMenuImage(url));
        galleryList.appendChild(div);
    });
    if(window.lucide) lucide.createIcons();
}

imageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(!restaurantId) return;

    const url = document.getElementById('img-url').value.trim();
    if(!url) return;

    try {
        await updateDoc(doc(db, "restaurants", restaurantId), {
            menuImages: arrayUnion(url)
        });
        location.reload();
    } catch (error) {
        console.error(error);
        alert("Error adding image");
    }
});

async function deleteMenuImage(url) {
    if(!confirm("Remove this image?")) return;
    try {
        await updateDoc(doc(db, "restaurants", restaurantId), {
            menuImages: arrayRemove(url)
        });
        location.reload();
    } catch (error) {
        console.error(error);
        alert("Error deleting image");
    }
}