// ==============================================================================
// GateNest - Apartment Visitor Management System
// File: script.js - Core Frontend Client Logic & REST API Integrations
// ==============================================================================

// Global Toast Notification Helper
function showToast(message, type = "success") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let iconClass = "fa-circle-check";
    if (type === "danger") iconClass = "fa-circle-xmark";
    if (type === "warning") iconClass = "fa-triangle-exclamation";
    if (type === "info") iconClass = "fa-circle-info";

    toast.innerHTML = `
        <i class="fa-solid ${iconClass} toast-icon"></i>
        <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add("show"), 10);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Modal Management Helpers
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add("active");
        document.body.style.overflow = "hidden";
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "";
    }
}

// Close modal on backdrop click
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
        e.target.classList.remove("active");
        document.body.style.overflow = "";
    }
});

// Live Clock in Top Navigation
function initLiveClock() {
    const clockEl = document.getElementById("live-clock");
    if (!clockEl) return;

    function update() {
        const now = new Date();
        const options = { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        };
        clockEl.textContent = now.toLocaleDateString('en-US', options);
    }
    update();
    setInterval(update, 1000);
}

// Mobile Sidebar Toggle
function initMobileSidebar() {
    const toggleBtn = document.getElementById("mobile-menu-toggle");
    const sidebar = document.querySelector(".sidebar");
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener("click", () => {
            sidebar.classList.toggle("mobile-open");
        });
    }
}

// Format Date Utility
function formatDateTime(dateStr) {
    if (!dateStr) return '<span class="text-muted">--</span>';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// Populate Residents Dropdown for Check-In Forms
async function populateResidentsDropdown(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    try {
        const res = await fetch("/api/residents");
        const json = await res.json();
        if (json.success && json.data) {
            select.innerHTML = '<option value="">-- Choose Flat / Resident --</option>';
            json.data.forEach(r => {
                const opt = document.createElement("option");
                opt.value = r.resident_id;
                opt.textContent = `${r.flat_no} - ${r.name} (${r.phone})`;
                select.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("Error populating residents dropdown:", err);
    }
}

// Fast Checkout Action Handler
async function checkoutVisit(visitId) {
    if (!confirm(`Confirm check-out for Visit #${visitId}? The current exit time will be recorded in MySQL.`)) {
        return;
    }

    try {
        const res = await fetch(`/api/visits/${visitId}/checkout`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" }
        });
        const data = await res.json();

        if (res.ok && data.success) {
            showToast(data.message, "success");
            // Refresh tables if present on current page
            if (typeof loadDashboard === "function") loadDashboard();
            if (typeof loadVisits === "function") loadVisits();
            if (typeof loadSingleRecord === "function") loadSingleRecord();
        } else {
            showToast(data.message || "Checkout failed", "danger");
        }
    } catch (err) {
        showToast("Network error during checkout", "danger");
        console.error(err);
    }
}

// Initialize on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
    initLiveClock();
    initMobileSidebar();
});
