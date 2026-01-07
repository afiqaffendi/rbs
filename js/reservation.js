import { auth, db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- State ---
let currentRestaurant = null;
let restaurantId = new URLSearchParams(window.location.search).get('id');
let selectedDate = null;
let selectedTime = null;
let pax = 2;
let userUid = null;
let cart = {}; 
let baseDeposit = 50.00;

// --- Elements ---
const paxDisplay = document.getElementById('pax-display');
const dateInput = document.getElementById('date-picker');
const slotsContainer = document.getElementById('slots-container');
const availabilityMsg = document.getElementById('availability-msg');
const summaryText = document.getElementById('summary-text');
const bookBtn = document.getElementById('book-btn');
const resNameEl = document.getElementById('res-name');
const resAddrEl = document.getElementById('res-address');
const menuContainer = document.getElementById('menu-container');
const totalCostDisplay = document.getElementById('total-cost-display');

// NEW: Review Elements
const reviewsContainer = document.getElementById('reviews-container');
const avgRatingEl = document.getElementById('avg-rating');
const reviewCountEl = document.getElementById('review-count');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    if(dateInput) {
        dateInput.setAttribute('min', today);
        dateInput.value = today;
        selectedDate = today;
    }
});

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        userUid = user.uid;
        if (restaurantId) {
            await loadRestaurantData(restaurantId);
            loadReviews(restaurantId); // NEW: Fetch reviews
        } else {
            alert("No restaurant selected!");
            window.location.href = 'customer-home.html';
        }
    }
});

// --- Functions ---
async function loadRestaurantData(id) {
    try {
        const docRef = doc(db, "restaurants", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            currentRestaurant = docSnap.data();
            if(resNameEl) resNameEl.innerText = currentRestaurant.name;
            if(resAddrEl) resAddrEl.innerText = currentRestaurant.address || "Location info unavailable";
            
            if(selectedDate) renderTimeSlots();
            
            loadMenu(currentRestaurant.menuItems || []); 
        } else {
            if(resNameEl) resNameEl.innerText = "Restaurant Not Found";
        }
    } catch (error) {
        console.error("Error loading restaurant:", error);
    }
}

// === NEW: Load Reviews ===
async function loadReviews(restId) {
    try {
        // Query reviews for this restaurant
        const q = query(collection(db, "reviews"), where("restaurantId", "==", restId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            if(reviewCountEl) reviewCountEl.innerText = "0 Reviews";
            if(avgRatingEl) avgRatingEl.innerText = "New";
            if(reviewsContainer) reviewsContainer.innerHTML = '<p class="text-sm text-slate-400 italic">No reviews yet. Be the first!</p>';
            return;
        }

        let totalStars = 0;
        let reviewsHTML = '';

        snapshot.forEach(doc => {
            const data = doc.data();
            totalStars += data.rating;
            
            // Create Star Icons string
            let starsDisplay = '';
            for(let i=0; i<5; i++) {
                starsDisplay += `<i data-lucide="star" class="w-3 h-3 ${i < data.rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}"></i>`;
            }

            reviewsHTML += `
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div class="flex items-center gap-1 mb-2">
                        ${starsDisplay}
                    </div>
                    <p class="text-sm text-slate-700 leading-relaxed">"${data.comment}"</p>
                    <p class="text-[10px] text-slate-400 mt-2 font-bold uppercase">Verified Customer</p>
                </div>
            `;
        });

        // Calculate Average
        const avg = (totalStars / snapshot.size).toFixed(1);
        
        // Update UI
        if(avgRatingEl) avgRatingEl.innerText = avg;
        if(reviewCountEl) reviewCountEl.innerText = `${snapshot.size} Reviews`;
        if(reviewsContainer) {
            reviewsContainer.innerHTML = reviewsHTML;
            // Re-render icons for the new HTML
            if(window.lucide) lucide.createIcons();
        }

    } catch (error) {
        console.error("Error loading reviews:", error);
    }
}

// === Menu Loading Logic ===
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

// === Time Slots & Booking ===
window.updatePax = (change) => {
    if (pax + change >= 1 && pax + change <= 20) {
        pax += change;
        if(paxDisplay) paxDisplay.innerText = pax;
        if(selectedTime) checkAvailability(selectedTime);
    }
};

if(dateInput) {
    dateInput.addEventListener('change', (e) => {
        selectedDate = e.target.value;
        selectedTime = null; 
        renderTimeSlots();
        updateSummary();
        if(bookBtn) {
            bookBtn.disabled = true;
            bookBtn.innerText = "Select a Time";
            bookBtn.classList.remove('bg-green-600', 'bg-red-500', 'bg-slate-300', 'text-slate-500', 'bg-orange-500');
            bookBtn.classList.add('bg-slate-900');
        }
    });
}

function renderTimeSlots() {
    if(slotsContainer) slotsContainer.innerHTML = '';
    if(availabilityMsg) availabilityMsg.classList.add('hidden');

    if (!selectedDate || !currentRestaurant) return;

    // Smart Time Parser
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
            if (hours === 12) hours = 0;
            if (modifier === 'PM') hours += 12;
            return hours * 60 + minutes;
        };
        
        // Handle separator ("-" or "TO")
        let separator = hours.includes('-') ? '-' : 'to';
        const parts = hours.split(separator);
        if (parts.length !== 2) return []; 

        let start = parseTime(parts[0]);
        let end = parseTime(parts[1]);
        if(end <= start) end += 1440; 

        let slots = [];
        while(start + 120 <= end) { 
            let displayStart = start % 1440;
            let h = Math.floor(displayStart/60);
            let mm = displayStart%60;
            let amp = h>=12 ? 'PM' : 'AM';
            h = h%12 || 12;
            slots.push(`${h}:${mm.toString().padStart(2,'0')} ${amp}`);
            start += 60;
        }
        return slots;
    };

    const slots = generateSlots(currentRestaurant.operatingHours || "10:00 AM - 10:00 PM");

    slots.forEach(time => {
        const btn = document.createElement('button');
        btn.className = `
            py-3 px-2 rounded-xl text-sm font-bold border transition-all relative
            ${selectedTime === time 
                ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-teal-500 ring-offset-2' 
                : 'bg-white text-slate-600 border-slate-200 hover:border-teal-500 hover:text-teal-600'}
        `;
        btn.innerText = time;
        btn.onclick = () => {
            selectedTime = time;
            renderTimeSlots();
            checkAvailability(time);
        };
        if(slotsContainer) slotsContainer.appendChild(btn);
    });
}

async function checkAvailability(timeSlot) {
    updateSummary();
    if(bookBtn) {
        bookBtn.disabled = true;
        bookBtn.innerText = "Checking...";
    }
    
    try {
        const q = query(
            collection(db, "bookings"),
            where("restaurantId", "==", restaurantId),
            where("bookingDate", "==", selectedDate),
            where("timeSlot", "==", timeSlot),
            where("status", "in", ["confirmed", "pending_payment", "pending_verification"])
        );

        const snapshot = await getDocs(q);
        let occupiedPax = 0;
        snapshot.forEach(doc => occupiedPax += doc.data().pax);

        const capacity = currentRestaurant.capacity || 50;
        const remaining = capacity - occupiedPax;

        if (remaining <= 0) {
            bookBtn.innerText = "Slot Full";
            bookBtn.classList.add('bg-slate-300');
            showMsg("Slot Fully Booked", "text-red-500");
        } else if (pax > remaining) {
            bookBtn.innerText = "Insufficient Seats";
            bookBtn.classList.add('bg-orange-500');
            showMsg(`Only ${remaining} seats left`, "text-orange-600");
        } else {
            bookBtn.disabled = false;
            bookBtn.innerText = "Confirm Reservation";
            bookBtn.classList.remove('bg-slate-300', 'bg-orange-500');
            bookBtn.classList.add('bg-slate-900');
            showMsg(`Available (${remaining} left)`, "text-green-600");
        }

    } catch (e) {
        console.error(e);
    }
}

function showMsg(text, color) {
    if(availabilityMsg) {
        availabilityMsg.innerText = text;
        availabilityMsg.className = `text-center text-xs font-bold mt-2 ${color}`;
        availabilityMsg.classList.remove('hidden');
    }
}

function updateSummary() {
    if (summaryText) {
        summaryText.innerText = (selectedDate && selectedTime) ? `${selectedDate} @ ${selectedTime}` : "-- / --";
    }
}

// === MAIN BOOKING FUNCTION ===
window.handleBooking = async () => {
    if(!userUid) {
        alert("Please login first.");
        return;
    }
    
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
            status: "pending_payment", 
            createdAt: Timestamp.now()
        };
        
        const docRef = await addDoc(collection(db, "bookings"), bookingData);
        window.location.href = `payment.html?id=${docRef.id}`; 
        
    } catch (error) {
        console.error("Booking Error:", error);
        alert("Booking failed: " + error.message);
        if(bookBtn) {
            bookBtn.disabled = false;
            bookBtn.innerText = "Try Again";
        }
    }
};