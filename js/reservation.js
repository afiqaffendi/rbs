import { auth, db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { showToast } from './toast.js';

// --- STATE VARIABLES ---
let currentRestaurant = null;
let restaurantId = new URLSearchParams(window.location.search).get('id');
let selectedDate = null;
let selectedTime = null;
let pax = 2; 
let userUid = null;
let cart = {}; 
let baseDeposit = 50.00;
let assignedTableSize = null; 
let countdownInterval = null; 

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
const totalCostDisplay = document.getElementById('total-cost-display');

// Cart Summary Elements (NEW)
const cartSummaryContainer = document.getElementById('cart-summary-container');
const summaryBadge = document.getElementById('summary-badge');
const summaryItemsText = document.getElementById('summary-items-text');
const summaryTotalCost = document.getElementById('summary-total-cost');

// Countdown Elements
const estimationCard = document.getElementById('estimation-card');
const countdownDisplay = document.getElementById('countdown-display');
const targetTimeDisplay = document.getElementById('target-time-display');

// Gallery
const gallerySection = document.getElementById('gallery-section');
const galleryContainer = document.getElementById('gallery-container');
const lightboxModal = document.getElementById('lightbox-modal');
const lightboxImg = document.getElementById('lightbox-img');

// --- 1. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    if(dateInput) dateInput.setAttribute('min', today);

    // Restore state if returning from menu
    restoreSessionState();
});

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        userUid = user.uid;
        if (restaurantId) {
            await loadRestaurantData(restaurantId);
        } else {
            showToast("No restaurant selected!", "error");
            window.location.href = 'customer-home.html';
        }
    }
});

// --- NEW: NAVIGATION & STATE ---
function saveSessionState() {
    const state = {
        restaurantId: restaurantId,
        date: selectedDate,
        time: selectedTime,
        pax: pax,
        cart: cart
    };
    sessionStorage.setItem('dtebs_booking_draft', JSON.stringify(state));
}

function restoreSessionState() {
    const saved = sessionStorage.getItem('dtebs_booking_draft');
    if (saved) {
        const state = JSON.parse(saved);
        if (state.restaurantId === restaurantId) {
            if(state.date) {
                selectedDate = state.date;
                if(dateInput) dateInput.value = state.date;
            }
            if(state.time) selectedTime = state.time;
            if(state.pax) pax = state.pax;
            if(state.cart) cart = state.cart;
            
            if(paxDisplay) paxDisplay.innerText = pax;
            updateCartSummaryUI();
        }
    } else {
        if(dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
            selectedDate = today;
        }
    }
}

// CRITICAL: Expose to window for HTML button onclick
window.goToMenuSelection = () => {
    saveSessionState();
    window.location.href = `menu-selection.html?id=${restaurantId}`;
};

// --- 2. LOAD DATA ---
async function loadRestaurantData(id) {
    try {
        const docRef = doc(db, "restaurants", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            currentRestaurant = docSnap.data();
            
            if(resNameEl) resNameEl.innerText = currentRestaurant.name;
            if(resAddrEl) resAddrEl.innerText = currentRestaurant.address || "Location info unavailable";
            if(resImageEl) {
                const fallbackImg = `https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80&random=${id}`;
                resImageEl.src = currentRestaurant.imageUrl || fallbackImg;
            }
            
            if(selectedDate) renderTimeSlots();
            loadGallery(currentRestaurant.menuImages || []);
            
            // Restore Time Selection Visuals
            if(selectedTime) {
                setTimeout(() => {
                    // Try to find and click the button to trigger availability check
                    const allBtns = Array.from(slotsContainer.children);
                    const btn = allBtns.find(b => b.innerText === selectedTime);
                    if(btn) btn.click(); 
                    else checkAvailability(selectedTime);
                }, 500);
            }

        } else {
            if(resNameEl) resNameEl.innerText = "Restaurant Not Found";
        }
    } catch (error) {
        console.error("Error loading restaurant:", error);
    }
}

// --- 3. LOGIC ---
async function checkAvailability(timeSlot) {
    updateSummary();
    
    if(bookBtn) {
        bookBtn.disabled = true;
        bookBtn.innerText = "Checking tables...";
        bookBtn.classList.remove('bg-slate-900');
        bookBtn.classList.add('bg-slate-300');
    }

    try {
        const inventory = currentRestaurant.tableInventory || {}; 
        
        const q = query(
            collection(db, "bookings"),
            where("restaurantId", "==", restaurantId),
            where("bookingDate", "==", selectedDate),
            where("timeSlot", "==", timeSlot),
            where("status", "in", ["confirmed", "paid", "completed", "pending_payment"]) 
        );

        const snapshot = await getDocs(q);
        
        const occupiedTables = { "2pax": 0, "4pax": 0, "6pax": 0, "8pax": 0, "10pax": 0 };
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.assignedTableSize) {
                occupiedTables[data.assignedTableSize] = (occupiedTables[data.assignedTableSize] || 0) + 1;
            }
        });

        const tableSizes = [2, 4, 6, 8, 10]; 
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
                    break; 
                }
            }
        }

        if (foundSize) {
            assignedTableSize = foundSize; 
            bookBtn.disabled = false;
            bookBtn.innerText = "Confirm Reservation";
            bookBtn.classList.add('bg-slate-900');
            bookBtn.classList.remove('bg-slate-300');
            showToast(`Table for ${foundSize.replace('pax','')} available!`, "success");
        } else {
            assignedTableSize = null;
            bookBtn.innerText = "Full Capacity";
            showToast("No suitable tables available.", "error");
        }

    } catch (e) { 
        console.error(e); 
        bookBtn.innerText = "Error";
    }
}

window.handleBooking = async () => {
    if(!userUid) { showToast("Please login first.", "error"); return; }
    if(!assignedTableSize) { showToast("Please select an available time.", "error"); return; }

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
            assignedTableSize: assignedTableSize, 
            status: "pending_payment", 
            createdAt: Timestamp.now()
        };
        
        const docRef = await addDoc(collection(db, "bookings"), bookingData);
        sessionStorage.removeItem('dtebs_booking_draft');
        window.location.href = `payment.html?id=${docRef.id}`; 

    } catch (error) {
        console.error("Booking Error:", error);
        showToast("Booking failed: " + error.message, "error");
        if(bookBtn) { bookBtn.disabled = false; bookBtn.innerText = "Try Again"; }
    }
};

// --- 5. UI HELPERS ---

function updateCartSummaryUI() {
    let totalQty = 0;
    let totalMenuCost = 0;

    if (cart) {
        Object.values(cart).forEach(item => {
            totalQty += item.qty;
            totalMenuCost += (item.qty * item.price);
        });
    }

    if(totalQty > 0) {
        cartSummaryContainer.classList.remove('hidden');
        summaryBadge.innerText = totalQty;
        summaryItemsText.innerText = `${totalQty} Item${totalQty > 1 ? 's' : ''} Selected`;
        summaryTotalCost.innerText = `RM ${totalMenuCost.toFixed(2)}`;
    } else {
        cartSummaryContainer.classList.add('hidden');
    }
    
    if(totalCostDisplay) {
        totalCostDisplay.innerText = (baseDeposit + totalMenuCost).toFixed(2);
    }
}

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
        
        if(estimationCard) estimationCard.classList.add('hidden');
        if(countdownInterval) clearInterval(countdownInterval);

        if(bookBtn) {
            bookBtn.disabled = true;
            bookBtn.innerText = "Select a Time";
            bookBtn.classList.remove('bg-slate-900');
            bookBtn.classList.add('bg-slate-300');
        }
    });
}

function renderTimeSlots() {
    if(slotsContainer) slotsContainer.innerHTML = '';
    if(availabilityMsg) availabilityMsg.classList.add('hidden');
    if (!selectedDate || !currentRestaurant) return;

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
        const isSelected = (selectedTime === time);
        btn.className = `py-3 px-2 rounded-xl text-sm font-bold border transition-all relative ${isSelected ? 'bg-slate-900 text-white shadow-md ring-2 ring-teal-500' : 'bg-white text-slate-600 hover:border-teal-500'}`;
        btn.innerText = time;
        btn.onclick = () => {
            const allBtns = slotsContainer.querySelectorAll('button');
            allBtns.forEach(b => b.className = 'py-3 px-2 rounded-xl text-sm font-bold border transition-all bg-white text-slate-600 hover:border-teal-500');
            btn.className = 'py-3 px-2 rounded-xl text-sm font-bold border transition-all bg-slate-900 text-white shadow-md ring-2 ring-teal-500';
            
            selectedTime = time;
            updateEstimation(time); 
            checkAvailability(time); 
        };
        slotsContainer.appendChild(btn);
    });
}

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

function updateEstimation(timeStr) {
    if (!estimationCard || !countdownDisplay) return;
    estimationCard.classList.remove('hidden');
    targetTimeDisplay.innerText = timeStr; 
    if (!selectedDate) return;
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    hours = parseInt(hours);
    if (hours === 12 && modifier === 'AM') hours = 0;
    if (hours !== 12 && modifier === 'PM') hours += 12;
    const targetDate = new Date(selectedDate);
    targetDate.setHours(hours, parseInt(minutes), 0, 0);
    if (countdownInterval) clearInterval(countdownInterval);
    const updateTimer = () => {
        const now = new Date().getTime();
        const distance = targetDate.getTime() - now;
        if (distance < 0) {
            clearInterval(countdownInterval);
            countdownDisplay.innerText = "NOW";
            countdownDisplay.classList.add('text-green-400');
            return;
        }
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        if (days > 0) {
            countdownDisplay.innerText = `${days}d ${h}h ${m}m`;
        } else {
            countdownDisplay.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
    };
    updateTimer(); 
    countdownInterval = setInterval(updateTimer, 1000);
}