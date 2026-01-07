import { auth, db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- STATE VARIABLES ---
let currentRestaurant = null;
let restaurantId = new URLSearchParams(window.location.search).get('id');
let selectedDate = null;
let selectedTime = null;
let pax = 2; // Default guests
let userUid = null;
let cart = {}; 
let baseDeposit = 50.00;
let assignedTableSize = null; // Store the assigned table size here

// --- DOM ELEMENTS ---
const paxDisplay = document.getElementById('pax-display');
const dateInput = document.getElementById('date-picker');
const slotsContainer = document.getElementById('slots-container');
const availabilityMsg = document.getElementById('availability-msg');
const summaryText = document.getElementById('summary-text');
const bookBtn = document.getElementById('book-btn');
const resNameEl = document.getElementById('res-name');
const resAddrEl = document.getElementById('res-address');
const resImageEl = document.getElementById('res-image');
const menuContainer = document.getElementById('menu-container');
const totalCostDisplay = document.getElementById('total-cost-display');

// Gallery Elements
const gallerySection = document.getElementById('gallery-section');
const galleryContainer = document.getElementById('gallery-container');
const lightboxModal = document.getElementById('lightbox-modal');
const lightboxImg = document.getElementById('lightbox-img');

// Reviews Elements
const reviewsContainer = document.getElementById('reviews-container');
const avgRatingEl = document.getElementById('avg-rating');
const reviewCountEl = document.getElementById('review-count');

// --- 1. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Set Date Picker Min Value to Today
    const today = new Date().toISOString().split('T')[0];
    if(dateInput) {
        dateInput.setAttribute('min', today);
        dateInput.value = today;
        selectedDate = today;
    }
});

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // If not logged in, redirect or let them browse (logic depends on your flow)
        // For now, we redirect to ensure they can book
        window.location.href = 'index.html';
    } else {
        userUid = user.uid;
        if (restaurantId) {
            await loadRestaurantData(restaurantId);
            loadReviews(restaurantId);
        } else {
            alert("No restaurant selected!");
            window.location.href = 'customer-home.html';
        }
    }
});

// --- 2. LOAD RESTAURANT DETAILS (The part you were missing) ---
async function loadRestaurantData(id) {
    try {
        const docRef = doc(db, "restaurants", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            currentRestaurant = docSnap.data();
            
            // Update UI Text
            if(resNameEl) resNameEl.innerText = currentRestaurant.name;
            if(resAddrEl) resAddrEl.innerText = currentRestaurant.address || "Location info unavailable";
            if(resImageEl) {
                const fallbackImg = `https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80&random=${id}`;
                resImageEl.src = currentRestaurant.imageUrl || fallbackImg;
            }
            
            // Initialize Slots and Menu
            if(selectedDate) renderTimeSlots();
            loadMenu(currentRestaurant.menuItems || []); 
            loadGallery(currentRestaurant.menuImages || []);

        } else {
            if(resNameEl) resNameEl.innerText = "Restaurant Not Found";
        }
    } catch (error) {
        console.error("Error loading restaurant:", error);
    }
}

// --- 3. NEW LOGIC: TABLE AVAILABILITY ALGORITHM ---
async function checkAvailability(timeSlot) {
    updateSummary();
    
    if(bookBtn) {
        bookBtn.disabled = true;
        bookBtn.innerText = "Checking tables...";
        bookBtn.classList.remove('bg-slate-900');
        bookBtn.classList.add('bg-slate-300');
    }

    try {
        // A. GET INVENTORY (From the loaded restaurant data)
        const inventory = currentRestaurant.tableInventory || {}; 
        // Example: { "2pax": 5, "4pax": 10 }

        // B. FETCH EXISTING BOOKINGS for this Date & Time
        const q = query(
            collection(db, "bookings"),
            where("restaurantId", "==", restaurantId),
            where("bookingDate", "==", selectedDate),
            where("timeSlot", "==", timeSlot),
            where("status", "in", ["confirmed", "paid", "completed", "pending_payment"]) 
        );

        const snapshot = await getDocs(q);
        
        // Count how many tables of each size are occupied
        const occupiedTables = { "2pax": 0, "4pax": 0, "6pax": 0, "8pax": 0, "10pax": 0 };
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.assignedTableSize) {
                occupiedTables[data.assignedTableSize] = (occupiedTables[data.assignedTableSize] || 0) + 1;
            }
        });

        // C. FIND BEST FIT
        // We look for a table size that fits the group (Size >= Pax)
        const tableSizes = [2, 4, 6, 8, 10]; // Supported sizes
        let foundSize = null;
        let remaining = 0;

        for (let size of tableSizes) {
            if (size >= pax) {
                const sizeKey = `${size}pax`; 
                const totalOwned = inventory[sizeKey] || 0;
                const totalUsed = occupiedTables[sizeKey] || 0;

                if (totalUsed < totalOwned) {
                    foundSize = sizeKey;
                    remaining = totalOwned - totalUsed;
                    break; // Found the smallest suitable table!
                }
            }
        }

        // D. UPDATE UI BASED ON RESULT
        if (foundSize) {
            assignedTableSize = foundSize; // Save for booking
            bookBtn.disabled = false;
            bookBtn.innerText = "Confirm Reservation";
            bookBtn.classList.add('bg-slate-900');
            bookBtn.classList.remove('bg-slate-300');
            showMsg(`Table for ${foundSize.replace('pax','')} available! (${remaining} left)`, "text-green-600");
        } else {
            assignedTableSize = null;
            bookBtn.innerText = "Full Capacity";
            showMsg("No suitable tables available for this time.", "text-red-500");
        }

    } catch (e) { 
        console.error(e); 
        bookBtn.innerText = "Error";
    }
}

// --- 4. HANDLE BOOKING SUBMISSION ---
window.handleBooking = async () => {
    if(!userUid) { alert("Please login first."); return; }
    if(!assignedTableSize) { alert("Please select an available time first."); return; }

    const finalItems = Object.values(cart).filter(i => i.qty > 0);
    let menuTotal = 0;
    finalItems.forEach(i => menuTotal += (i.qty * i.price));
    const finalTotal = baseDeposit + menuTotal;

    if(bookBtn) {
        bookBtn.disabled = true;
        bookBtn.innerText = "Processing...";
    }

    try {
        const bookingData = {
            restaurantId: restaurantId,
            restaurantName: currentRestaurant.name,
            customerId: userUid,
            bookingDate: selectedDate,
            timeSlot: selectedTime,
            pax: parseInt(pax),
            menuItems: finalItems,
            totalCost: finalTotal,
            deposit: baseDeposit,
            
            // NEW FIELD: Save the specific table size we assigned
            assignedTableSize: assignedTableSize, 
            
            status: "pending_payment", 
            createdAt: Timestamp.now()
        };
        
        const docRef = await addDoc(collection(db, "bookings"), bookingData);
        window.location.href = `payment.html?id=${docRef.id}`; 

    } catch (error) {
        console.error("Booking Error:", error);
        alert("Booking failed: " + error.message);
        if(bookBtn) { bookBtn.disabled = false; bookBtn.innerText = "Try Again"; }
    }
};

// --- 5. UI HELPER FUNCTIONS (Pax, Time, Gallery, Menu) ---

// PAX Logic
window.updatePax = (change) => {
    if (pax + change >= 1 && pax + change <= 20) {
        pax += change;
        if(paxDisplay) paxDisplay.innerText = pax;
        if(selectedTime) checkAvailability(selectedTime); // Re-check if group size changes
    }
};

// Date Logic
if(dateInput) {
    dateInput.addEventListener('change', (e) => {
        selectedDate = e.target.value;
        selectedTime = null; 
        renderTimeSlots();
        updateSummary();
        if(bookBtn) {
            bookBtn.disabled = true;
            bookBtn.innerText = "Select a Time";
            bookBtn.classList.remove('bg-slate-900');
            bookBtn.classList.add('bg-slate-300');
        }
    });
}

// Time Slot Logic
function renderTimeSlots() {
    if(slotsContainer) slotsContainer.innerHTML = '';
    if(availabilityMsg) availabilityMsg.classList.add('hidden');
    if (!selectedDate || !currentRestaurant) return;

    // Helper to generate times (e.g. 10:00 AM - 10:00 PM)
    const generateSlots = (hours) => {
        const parseTime = (t) => {
            t = t.trim().toUpperCase(); 
            let hours = 0, minutes = 0;
            let modifier = 'AM';
            if (t.includes('PM')) modifier = 'PM';
            if (t.includes('AM')) modifier = 'AM';
            const cleanTime = t.replace(/(AM|PM)/g, '').trim();
            if (cleanTime.includes(':')) {
                const parts = cleanTime.split(':');
                hours = parseInt(parts[0]);
                minutes = parseInt(parts[1]);
            } else {
                hours = parseInt(cleanTime);
            }
            if (hours === 12 && modifier === 'AM') hours = 0; 
            if (hours !== 12 && modifier === 'PM') hours += 12;
            return hours * 60 + minutes;
        };
        
        let separator = hours.includes('-') ? '-' : 'to';
        const parts = hours.split(separator);
        if (parts.length !== 2) return []; 
        let start = parseTime(parts[0]);
        let end = parseTime(parts[1]);
        if(end <= start) end += 1440; 
        
        let slots = [];
        // Create 60 minute intervals (adjustable)
        while(start + 60 <= end) { 
            let displayStart = start % 1440;
            let h = Math.floor(displayStart/60);
            let mm = displayStart%60;
            let amp = h>=12 ? 'PM' : 'AM';
            let displayH = h%12 || 12;
            
            slots.push(`${displayH}:${mm.toString().padStart(2,'0')} ${amp}`);
            start += 60; 
        }
        return slots;
    };

    const slots = generateSlots(currentRestaurant.operatingHours || "10:00 AM - 10:00 PM");

    slots.forEach(time => {
        const btn = document.createElement('button');
        btn.className = `py-3 px-2 rounded-xl text-sm font-bold border transition-all relative ${selectedTime === time ? 'bg-slate-900 text-white shadow-md ring-2 ring-teal-500' : 'bg-white text-slate-600 hover:border-teal-500'}`;
        btn.innerText = time;
        btn.onclick = () => {
            // Visual Update
            const allBtns = slotsContainer.querySelectorAll('button');
            allBtns.forEach(b => b.className = 'py-3 px-2 rounded-xl text-sm font-bold border transition-all bg-white text-slate-600 hover:border-teal-500');
            btn.className = 'py-3 px-2 rounded-xl text-sm font-bold border transition-all bg-slate-900 text-white shadow-md ring-2 ring-teal-500';
            
            selectedTime = time;
            checkAvailability(time); // Run the Table Logic
        };
        slotsContainer.appendChild(btn);
    });
}

// Menu & Cart Logic
function loadMenu(items) {
    if(!menuContainer) return;
    if (!items || items.length === 0) {
        menuContainer.innerHTML = '<p class="text-sm text-slate-400 italic">No pre-order menu available.</p>';
        return;
    }
    menuContainer.innerHTML = ''; 
    items.forEach((item, index) => {
        const itemId = `item-${index}`;
        const card = document.createElement('div');
        card.className = "flex justify-between items-center bg-white p-3 rounded-lg border border-slate-100 shadow-sm";
        card.innerHTML = `
            <div>
                <h4 class="font-bold text-slate-800 text-sm">${item.name}</h4>
                <p class="text-sm font-semibold text-teal-600 mt-1">RM ${parseFloat(item.price).toFixed(2)}</p>
            </div>
            <div class="flex items-center space-x-3">
                <button onclick="updateCart('${itemId}', '${item.name}', ${item.price}, -1)" class="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold hover:bg-slate-200">-</button>
                <span id="qty-${itemId}" class="font-bold text-slate-800 w-4 text-center">0</span>
                <button onclick="updateCart('${itemId}', '${item.name}', ${item.price}, 1)" class="w-8 h-8 rounded-full bg-slate-900 text-white font-bold hover:bg-slate-800">+</button>
            </div>
        `;
        menuContainer.appendChild(card);
    });
}

window.updateCart = (id, name, price, change) => {
    if (!cart[id]) cart[id] = { name, price, qty: 0 };
    cart[id].qty += change;
    if (cart[id].qty < 0) cart[id].qty = 0;
    const qtyEl = document.getElementById(`qty-${id}`);
    if(qtyEl) qtyEl.innerText = cart[id].qty;
    calculateTotal();
};

function calculateTotal() {
    let menuTotal = 0;
    Object.values(cart).forEach(item => {
        menuTotal += item.qty * item.price;
    });
    const total = baseDeposit + menuTotal;
    if(totalCostDisplay) totalCostDisplay.innerText = total.toFixed(2);
}

// Gallery & Reviews Loaders
function loadGallery(images) {
    if (!images || images.length === 0) {
        gallerySection.classList.add('hidden');
        return;
    }
    gallerySection.classList.remove('hidden');
    galleryContainer.innerHTML = '';
    images.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.className = "h-24 w-32 object-cover rounded-lg shrink-0 border border-slate-200 cursor-zoom-in hover:opacity-90 transition";
        img.onclick = () => { lightboxImg.src = url; lightboxModal.classList.remove('hidden'); };
        galleryContainer.appendChild(img);
    });
}
window.closeLightbox = () => lightboxModal.classList.add('hidden');

async function loadReviews(restId) {
    try {
        const q = query(collection(db, "reviews"), where("restaurantId", "==", restId));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            if(reviewCountEl) reviewCountEl.innerText = "0 Reviews";
            if(avgRatingEl) avgRatingEl.innerText = "New";
            return;
        }
        let totalStars = 0;
        let reviewsHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            totalStars += data.rating;
            let starsDisplay = '';
            for(let i=0; i<5; i++) starsDisplay += `<i data-lucide="star" class="w-3 h-3 ${i < data.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}"></i>`;
            reviewsHTML += `<div class="bg-slate-50 p-3 rounded-xl border border-slate-100"><div class="flex items-center gap-1 mb-2">${starsDisplay}</div><p class="text-sm text-slate-700">"${data.comment}"</p></div>`;
        });
        const avg = (totalStars / snapshot.size).toFixed(1);
        if(avgRatingEl) avgRatingEl.innerText = avg;
        if(reviewCountEl) reviewCountEl.innerText = `${snapshot.size} Reviews`;
        if(reviewsContainer) { reviewsContainer.innerHTML = reviewsHTML; if(window.lucide) lucide.createIcons(); }
    } catch (e) { console.error(e); }
}

function showMsg(text, color) {
    if(availabilityMsg) {
        availabilityMsg.innerText = text;
        availabilityMsg.className = `text-center text-xs font-bold mt-2 ${color}`;
        availabilityMsg.classList.remove('hidden');
    }
}

function updateSummary() {
    if (summaryText) summaryText.innerText = (selectedDate && selectedTime) ? `${selectedDate} @ ${selectedTime}` : "-- / --";
}