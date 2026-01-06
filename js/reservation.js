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

// --- Elements ---
const paxDisplay = document.getElementById('pax-display');
const dateInput = document.getElementById('date-picker');
const slotsContainer = document.getElementById('slots-container');
const availabilityMsg = document.getElementById('availability-msg');
const summaryText = document.getElementById('summary-text');
const bookBtn = document.getElementById('book-btn');
const resNameEl = document.getElementById('res-name');
const resAddrEl = document.getElementById('res-address');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    if(window.lucide) lucide.createIcons();
    
    // UX IMPROVEMENT: Auto-set today's date
    const today = new Date().toISOString().split('T')[0];
    if(dateInput) {
        dateInput.setAttribute('min', today);
        dateInput.value = today; // Auto-select today
        selectedDate = today;    // Sync state
    }
});

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        userUid = user.uid;
        if (restaurantId) {
            await loadRestaurantData(restaurantId);
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
            
            // Re-render slots if date is already selected
            if(selectedDate) renderTimeSlots();
        } else {
            if(resNameEl) resNameEl.innerText = "Restaurant Not Found";
        }
    } catch (error) {
        console.error("Error loading restaurant:", error);
    }
}

window.updatePax = (change) => {
    if (pax + change >= 1 && pax + change <= 20) {
        pax += change;
        if(paxDisplay) paxDisplay.innerText = pax;
        // UX IMPROVEMENT: Re-check availability immediately if user changes group size
        if(selectedTime) checkAvailability(selectedTime);
    }
};

if(dateInput) {
    dateInput.addEventListener('change', (e) => {
        selectedDate = e.target.value;
        selectedTime = null; 
        renderTimeSlots();
        updateSummary();
        // Reset button state
        if(bookBtn) {
            bookBtn.disabled = true;
            bookBtn.innerText = "Select a Time";
            bookBtn.classList.remove('bg-green-600', 'bg-red-500', 'bg-slate-300', 'text-slate-500', 'bg-orange-500');
            bookBtn.classList.add('bg-slate-900');
        }
    });
}

function generateTimeSlots(operatingHours) {
    const parseTime = (t) => {
        const [time, modifier] = t.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (hours === 12) hours = 0;
        if (modifier === 'PM') hours += 12;
        return hours * 60 + minutes;
    };

    const formatTime = (m) => {
        let h = Math.floor(m / 60);
        let mm = m % 60;
        let amp = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${mm.toString().padStart(2, '0')} ${amp}`;
    };

    if(!operatingHours) return [];
    
    const [startStr, endStr] = operatingHours.split(' - ');
    let startMin = parseTime(startStr);
    let endMin = parseTime(endStr);
    
    let slots = [];
    while (startMin + 120 <= endMin) {
        slots.push(formatTime(startMin));
        startMin += 60; 
    }
    return slots;
}

function renderTimeSlots() {
    if(slotsContainer) slotsContainer.innerHTML = '';
    if(availabilityMsg) availabilityMsg.classList.add('hidden');

    if (!selectedDate || !currentRestaurant) return;

    const slots = generateTimeSlots(currentRestaurant.operatingHours);

    slots.forEach(time => {
        const btn = document.createElement('button');
        // UX IMPROVEMENT: Added ring effect for selected state
        btn.className = `
            py-3 px-2 rounded-xl text-sm font-bold border transition-all relative
            ${selectedTime === time 
                ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-teal-500 ring-offset-2' 
                : 'bg-white text-slate-600 border-slate-200 hover:border-teal-500 hover:text-teal-600'}
        `;
        btn.innerText = time;
        
        btn.onclick = () => {
            selectedTime = time;
            renderTimeSlots(); // Re-render to show active state
            checkAvailability(time);
        };
        if(slotsContainer) slotsContainer.appendChild(btn);
    });
}

// --- PHASE 2: Enhanced Availability Check (SMART MESSAGES) ---
async function checkAvailability(timeSlot) {
    updateSummary();
    
    if(bookBtn) {
        bookBtn.disabled = true;
        bookBtn.innerText = "Checking Availability...";
        // Reset styles
        bookBtn.classList.remove('bg-red-500', 'bg-slate-300', 'text-slate-500', 'bg-green-600', 'bg-orange-500');
        bookBtn.classList.add('bg-slate-900');
    }
    
    if(availabilityMsg) {
        availabilityMsg.classList.add('hidden');
        availabilityMsg.className = "text-center text-xs font-bold mt-2 hidden"; // Reset classes
    }

    try {
        const q = query(
            collection(db, "bookings"),
            where("restaurantId", "==", restaurantId),
            where("bookingDate", "==", selectedDate),
            where("timeSlot", "==", timeSlot),
            // Check ALL occupied slots, even those pending payment
            where("status", "in", ["confirmed", "pending_payment", "pending_verification"])
        );

        const snapshot = await getDocs(q);
        let occupiedPax = 0;
        snapshot.forEach(doc => occupiedPax += doc.data().pax);

        const capacity = currentRestaurant.capacity || 50;
        const remaining = capacity - occupiedPax;

        // LOGIC: Check scenarios
        if (remaining <= 0) {
            // SCENARIO A: Full
            if(bookBtn) {
                bookBtn.innerText = "Slot Full";
                bookBtn.classList.remove('bg-slate-900');
                bookBtn.classList.add('bg-slate-300', 'text-slate-500'); // Visual disabled style
            }
            showAvailabilityMsg(`Sorry, this slot is fully booked.`, "text-red-500");

        } else if (pax > remaining) {
            // SCENARIO B: Available, but not for this group size
            if(bookBtn) {
                bookBtn.innerText = "Insufficient Seats";
                bookBtn.classList.remove('bg-slate-900');
                bookBtn.classList.add('bg-orange-500', 'text-white');
            }
            showAvailabilityMsg(`Only ${remaining} seats left. Please reduce pax.`, "text-orange-600");

        } else {
            // SCENARIO C: Available
            if(bookBtn) {
                bookBtn.disabled = false;
                bookBtn.innerText = "Confirm Reservation";
                bookBtn.classList.remove('bg-slate-300', 'text-slate-500', 'bg-orange-500');
                bookBtn.classList.add('bg-slate-900'); // Or your primary color
            }
            
            // Show "Hurry" message if low availability
            if (remaining < 10) {
                showAvailabilityMsg(`Hurry! Only ${remaining} seats remaining.`, "text-orange-600");
            } else {
                showAvailabilityMsg(`Available (${remaining} seats left)`, "text-green-600");
            }
        }

    } catch (e) {
        console.error(e);
        if(bookBtn) bookBtn.innerText = "Error Checking";
    }
}

function showAvailabilityMsg(text, colorClass) {
    if(availabilityMsg) {
        availabilityMsg.innerText = text;
        availabilityMsg.className = `text-center text-xs font-bold mt-2 ${colorClass}`;
        availabilityMsg.classList.remove('hidden');
    }
}

function updateSummary() {
    if (summaryText) {
        if (selectedDate && selectedTime) {
            summaryText.innerText = `${selectedDate} @ ${selectedTime}`;
        } else {
            summaryText.innerText = "-- / --";
        }
    }
}

// === Phase 1 Logic: Save directly to Firestore ===
window.handleBooking = async () => {
    if(!userUid) {
        alert("Please login first.");
        return;
    }

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
            menuItems: [],
            totalCost: 50.00, // Fixed price for now
            deposit: 50.00,
            status: "pending_payment", 
            createdAt: Timestamp.now()
        };
        
        // Save to Firestore
        const docRef = await addDoc(collection(db, "bookings"), bookingData);
        // Redirect with ID
        window.location.href = `payment.html?id=${docRef.id}`; 
        
    } catch (error) {
        console.error("Booking Error:", error);
        alert("Failed to create booking: " + error.message);
        if(bookBtn) {
            bookBtn.disabled = false;
            bookBtn.innerText = "Try Again";
        }
    }
};