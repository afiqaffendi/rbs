// Import necessary Firebase functions (Adjust based on your file structure)
import { getFirestore, doc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

const db = getFirestore();
const auth = getAuth();

window.saveTableConfig = async function() {
    // 1. Get the current logged-in Restaurant Owner ID
    const user = auth.currentUser;
    
    if (!user) {
        alert("Please login first!");
        return;
    }

    // 2. Get values from the HTML inputs
    // We use 'parseInt' to ensure they are saved as Numbers, not Strings
    const inventory = {
        "2pax": parseInt(document.getElementById('qty2pax').value) || 0,
        "4pax": parseInt(document.getElementById('qty4pax').value) || 0,
        "6pax": parseInt(document.getElementById('qty6pax').value) || 0,
        "8pax": parseInt(document.getElementById('qty8pax').value) || 0,
        "10pax": parseInt(document.getElementById('qty10pax').value) || 0
    };

    // 3. Define the path: restaurants -> {restaurantID}
    // We assume you store restaurant details in a collection named "restaurants"
    const restaurantRef = doc(db, "restaurants", user.uid);

    try {
        // 4. Save to Firebase
        // We use 'setDoc' with { merge: true } so we don't overwrite other data (like name, address)
        await setDoc(restaurantRef, { 
            tableInventory: inventory,
            totalCapacityChecked: true // Flag to show setup is done
        }, { merge: true });

        alert("Table configuration saved successfully!");
        console.log("Saved Inventory:", inventory);

    } catch (error) {
        console.error("Error saving tables:", error);
        alert("Failed to save. Check console for details.");
    }
}