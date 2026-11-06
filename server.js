// ==============================================================================
// GateNest - Apartment Visitor Management System
// File: server.js - Express.js REST API Server
// ==============================================================================

const express = require("express");
const path = require("path");
require("dotenv").config();
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON and URL-encoded request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files from the "public" folder
app.use(express.static(path.join(__dirname, "public")));

// ==============================================================================
// 1. DASHBOARD & ANALYTICS APIs
// ==============================================================================

// GET /api/stats - Real-time statistics for the dashboard
app.get("/api/stats", async (req, res) => {
    try {
        const [resCount] = await db.query("SELECT COUNT(*) AS totalResidents FROM residents");
        const [visCount] = await db.query("SELECT COUNT(*) AS totalVisitors FROM visitors");
        const [insideCount] = await db.query("SELECT COUNT(*) AS insideVisitors FROM visits WHERE status = 'Inside'");
        const [completedCount] = await db.query("SELECT COUNT(*) AS completedVisits FROM visits WHERE status = 'Completed'");

        // Today's total entries
        const [todayCount] = await db.query("SELECT COUNT(*) AS todayVisits FROM visits WHERE DATE(entry_time) = CURDATE()");

        // Recent 6 visits with combined resident and visitor details
        const [recentVisits] = await db.query(`
            SELECT 
                v.visit_id,
                v.entry_time,
                v.exit_time,
                v.status,
                r.resident_id,
                r.name AS resident_name,
                r.flat_no,
                r.phone AS resident_phone,
                vis.visitor_id,
                vis.name AS visitor_name,
                vis.phone AS visitor_phone,
                vis.vehicle_no,
                vis.purpose
            FROM visits v
            JOIN residents r ON v.resident_id = r.resident_id
            JOIN visitors vis ON v.visitor_id = vis.visitor_id
            ORDER BY v.entry_time DESC
            LIMIT 6
        `);

        // Currently Inside active visitors list (for fast check-out table on dashboard)
        const [activeInside] = await db.query(`
            SELECT 
                v.visit_id,
                v.entry_time,
                v.status,
                r.resident_id,
                r.name AS resident_name,
                r.flat_no,
                vis.visitor_id,
                vis.name AS visitor_name,
                vis.phone AS visitor_phone,
                vis.vehicle_no,
                vis.purpose
            FROM visits v
            JOIN residents r ON v.resident_id = r.resident_id
            JOIN visitors vis ON v.visitor_id = vis.visitor_id
            WHERE v.status = 'Inside'
            ORDER BY v.entry_time DESC
        `);

        res.json({
            success: true,
            stats: {
                totalResidents: resCount[0].totalResidents,
                totalVisitors: visCount[0].totalVisitors,
                insideVisitors: insideCount[0].insideVisitors,
                completedVisits: completedCount[0].completedVisits,
                todayVisits: todayCount[0].todayVisits
            },
            recentVisits,
            activeInside
        });
    } catch (err) {
        console.error("Error fetching dashboard stats:", err);
        res.status(500).json({ success: false, message: "Database error fetching statistics", error: err.message });
    }
});

// ==============================================================================
// 2. RESIDENTS REST APIs (TABLE 1: residents)
// ==============================================================================

// GET /api/residents - Retrieve all residents (with optional search query)
app.get("/api/residents", async (req, res) => {
    try {
        const { search } = req.query;
        let query = `
            SELECT r.*, COUNT(v.visit_id) AS total_visits
            FROM residents r
            LEFT JOIN visits v ON r.resident_id = v.resident_id
        `;
        const params = [];

        if (search) {
            query += " WHERE r.name LIKE ? OR r.flat_no LIKE ? OR r.phone LIKE ? OR r.email LIKE ?";
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }

        query += " GROUP BY r.resident_id ORDER BY r.flat_no ASC";

        const [rows] = await db.query(query, params);
        res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        console.error("Error fetching residents:", err);
        res.status(500).json({ success: false, message: "Failed to fetch residents", error: err.message });
    }
});

// GET /api/residents/:id - Retrieve single resident by ID with full visit history
app.get("/api/residents/:id", async (req, res) => {
    try {
        const residentId = req.params.id;
        const [residentRows] = await db.query("SELECT * FROM residents WHERE resident_id = ?", [residentId]);

        if (residentRows.length === 0) {
            return res.status(404).json({ success: false, message: `Resident with ID #${residentId} not found.` });
        }

        // Fetch all visitor visits associated with this resident
        const [visitHistory] = await db.query(`
            SELECT 
                v.visit_id,
                v.entry_time,
                v.exit_time,
                v.status,
                vis.visitor_id,
                vis.name AS visitor_name,
                vis.phone AS visitor_phone,
                vis.vehicle_no,
                vis.purpose
            FROM visits v
            JOIN visitors vis ON v.visitor_id = vis.visitor_id
            WHERE v.resident_id = ?
            ORDER BY v.entry_time DESC
        `, [residentId]);

        res.json({
            success: true,
            data: {
                ...residentRows[0],
                visits: visitHistory
            }
        });
    } catch (err) {
        console.error("Error fetching resident details:", err);
        res.status(500).json({ success: false, message: "Failed to fetch resident details", error: err.message });
    }
});

// POST /api/residents - Add a new resident
app.post("/api/residents", async (req, res) => {
    try {
        const { name, flat_no, phone, email } = req.body;

        // Validation
        if (!name || !flat_no || !phone) {
            return res.status(400).json({
                success: false,
                message: "Validation Error: Name, Flat Number, and Phone Number are required fields."
            });
        }

        // Clean & format
        const cleanName = name.trim();
        const cleanFlat = flat_no.trim().toUpperCase();
        const cleanPhone = phone.trim();
        const cleanEmail = email ? email.trim().toLowerCase() : null;

        // Basic phone validation (10 digits)
        if (!/^[0-9+\-\s]{8,15}$/.test(cleanPhone)) {
            return res.status(400).json({
                success: false,
                message: "Validation Error: Please provide a valid phone number (8-15 digits)."
            });
        }

        const [result] = await db.query(
            "INSERT INTO residents (name, flat_no, phone, email) VALUES (?, ?, ?, ?)",
            [cleanName, cleanFlat, cleanPhone, cleanEmail]
        );

        res.status(201).json({
            success: true,
            message: `Resident "${cleanName}" registered successfully for Flat ${cleanFlat}!`,
            resident_id: result.insertId
        });
    } catch (err) {
        console.error("Error adding resident:", err);
        res.status(500).json({ success: false, message: "Database error while adding resident", error: err.message });
    }
});

// PUT /api/residents/:id - Update an existing resident
app.put("/api/residents/:id", async (req, res) => {
    try {
        const residentId = req.params.id;
        const { name, flat_no, phone, email } = req.body;

        // Check if resident exists
        const [existing] = await db.query("SELECT * FROM residents WHERE resident_id = ?", [residentId]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: `Resident #${residentId} not found.` });
        }

        if (!name || !flat_no || !phone) {
            return res.status(400).json({
                success: false,
                message: "Validation Error: Name, Flat Number, and Phone are required."
            });
        }

        await db.query(
            "UPDATE residents SET name = ?, flat_no = ?, phone = ?, email = ? WHERE resident_id = ?",
            [name.trim(), flat_no.trim().toUpperCase(), phone.trim(), email ? email.trim() : null, residentId]
        );

        res.json({
            success: true,
            message: `Resident #${residentId} updated successfully.`
        });
    } catch (err) {
        console.error("Error updating resident:", err);
        res.status(500).json({ success: false, message: "Database error while updating resident", error: err.message });
    }
});

// DELETE /api/residents/:id - Delete a resident with Foreign Key Protection
app.delete("/api/residents/:id", async (req, res) => {
    try {
        const residentId = req.params.id;

        // Check if resident exists
        const [existing] = await db.query("SELECT * FROM residents WHERE resident_id = ?", [residentId]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: `Resident record #${residentId} does not exist.` });
        }

        // Check for existing visit records (due to ON DELETE RESTRICT)
        const [linkedVisits] = await db.query(
            "SELECT COUNT(*) AS count FROM visits WHERE resident_id = ?",
            [residentId]
        );

        if (linkedVisits[0].count > 0) {
            return res.status(409).json({
                success: false,
                isRestricted: true,
                message: `Constraint Violation: Cannot delete Resident "${existing[0].name}" (Flat ${existing[0].flat_no}). There are ${linkedVisits[0].count} active or historical visit record(s) linked to this resident. The MySQL ON DELETE RESTRICT constraint protects security audit records.`
            });
        }

        await db.query("DELETE FROM residents WHERE resident_id = ?", [residentId]);
        res.json({
            success: true,
            message: `Resident #${residentId} ("${existing[0].name}") has been deleted successfully.`
        });
    } catch (err) {
        if (err.errno === 1451 || err.code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(409).json({
                success: false,
                isRestricted: true,
                message: "Foreign Key Restriction: Cannot delete resident because visit records reference this flat in MySQL."
            });
        }
        console.error("Error deleting resident:", err);
        res.status(500).json({ success: false, message: "Failed to delete resident", error: err.message });
    }
});

// ==============================================================================
// 3. VISITORS REST APIs (TABLE 2: visitors)
// ==============================================================================

// GET /api/visitors - Retrieve all registered visitors (with optional search query)
app.get("/api/visitors", async (req, res) => {
    try {
        const { search } = req.query;
        let query = `
            SELECT v.*, COUNT(vt.visit_id) AS total_visits,
                   MAX(vt.entry_time) AS last_visit_time
            FROM visitors v
            LEFT JOIN visits vt ON v.visitor_id = vt.visitor_id
        `;
        const params = [];

        if (search) {
            query += " WHERE v.name LIKE ? OR v.phone LIKE ? OR v.vehicle_no LIKE ? OR v.purpose LIKE ?";
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }

        query += " GROUP BY v.visitor_id ORDER BY v.visitor_id DESC";

        const [rows] = await db.query(query, params);
        res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        console.error("Error fetching visitors:", err);
        res.status(500).json({ success: false, message: "Failed to fetch visitors", error: err.message });
    }
});

// GET /api/visitors/:id - Retrieve single visitor by ID with full visit history
app.get("/api/visitors/:id", async (req, res) => {
    try {
        const visitorId = req.params.id;
        const [visitorRows] = await db.query("SELECT * FROM visitors WHERE visitor_id = ?", [visitorId]);

        if (visitorRows.length === 0) {
            return res.status(404).json({ success: false, message: `Visitor #${visitorId} not found.` });
        }

        // Fetch visit history with resident details
        const [visitHistory] = await db.query(`
            SELECT 
                v.visit_id,
                v.entry_time,
                v.exit_time,
                v.status,
                r.resident_id,
                r.name AS resident_name,
                r.flat_no,
                r.phone AS resident_phone
            FROM visits v
            JOIN residents r ON v.resident_id = r.resident_id
            WHERE v.visitor_id = ?
            ORDER BY v.entry_time DESC
        `, [visitorId]);

        res.json({
            success: true,
            data: {
                ...visitorRows[0],
                visits: visitHistory
            }
        });
    } catch (err) {
        console.error("Error fetching visitor details:", err);
        res.status(500).json({ success: false, message: "Failed to fetch visitor details", error: err.message });
    }
});

// POST /api/visitors - Register a new visitor
app.post("/api/visitors", async (req, res) => {
    try {
        const { name, phone, vehicle_no, purpose } = req.body;

        if (!name || !phone || !purpose) {
            return res.status(400).json({
                success: false,
                message: "Validation Error: Visitor Name, Phone Number, and Purpose are required."
            });
        }

        const [result] = await db.query(
            "INSERT INTO visitors (name, phone, vehicle_no, purpose) VALUES (?, ?, ?, ?)",
            [name.trim(), phone.trim(), vehicle_no ? vehicle_no.trim().toUpperCase() : null, purpose.trim()]
        );

        res.status(201).json({
            success: true,
            message: `Visitor "${name.trim()}" registered successfully!`,
            visitor_id: result.insertId
        });
    } catch (err) {
        console.error("Error registering visitor:", err);
        res.status(500).json({ success: false, message: "Database error registering visitor", error: err.message });
    }
});

// PUT /api/visitors/:id - Update visitor details
app.put("/api/visitors/:id", async (req, res) => {
    try {
        const visitorId = req.params.id;
        const { name, phone, vehicle_no, purpose } = req.body;

        const [existing] = await db.query("SELECT * FROM visitors WHERE visitor_id = ?", [visitorId]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: `Visitor #${visitorId} not found.` });
        }

        if (!name || !phone || !purpose) {
            return res.status(400).json({
                success: false,
                message: "Validation Error: Name, Phone, and Purpose are required."
            });
        }

        await db.query(
            "UPDATE visitors SET name = ?, phone = ?, vehicle_no = ?, purpose = ? WHERE visitor_id = ?",
            [name.trim(), phone.trim(), vehicle_no ? vehicle_no.trim().toUpperCase() : null, purpose.trim(), visitorId]
        );

        res.json({
            success: true,
            message: `Visitor #${visitorId} updated successfully.`
        });
    } catch (err) {
        console.error("Error updating visitor:", err);
        res.status(500).json({ success: false, message: "Database error updating visitor", error: err.message });
    }
});

// DELETE /api/visitors/:id - Delete a visitor with Foreign Key Protection
app.delete("/api/visitors/:id", async (req, res) => {
    try {
        const visitorId = req.params.id;

        const [existing] = await db.query("SELECT * FROM visitors WHERE visitor_id = ?", [visitorId]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: `Visitor #${visitorId} does not exist.` });
        }

        // Check for existing visits
        const [linkedVisits] = await db.query(
            "SELECT COUNT(*) AS count FROM visits WHERE visitor_id = ?",
            [visitorId]
        );

        if (linkedVisits[0].count > 0) {
            return res.status(409).json({
                success: false,
                isRestricted: true,
                message: `Constraint Violation: Cannot delete Visitor "${existing[0].name}". There are ${linkedVisits[0].count} visit record(s) linked in the database. MySQL ON DELETE RESTRICT prevents deleting visitor profiles that have active or completed visits.`
            });
        }

        await db.query("DELETE FROM visitors WHERE visitor_id = ?", [visitorId]);
        res.json({
            success: true,
            message: `Visitor #${visitorId} ("${existing[0].name}") deleted successfully.`
        });
    } catch (err) {
        if (err.errno === 1451 || err.code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(409).json({
                success: false,
                isRestricted: true,
                message: "Foreign Key Restriction: Cannot delete visitor because visit log references exist in MySQL."
            });
        }
        console.error("Error deleting visitor:", err);
        res.status(500).json({ success: false, message: "Failed to delete visitor", error: err.message });
    }
});

// ==============================================================================
// 4. VISITS REST APIs (TABLE 3: visits)
// ==============================================================================

// GET /api/visits - Retrieve all visits with full resident & visitor details (filters by status, date, search)
app.get("/api/visits", async (req, res) => {
    try {
        const { status, date, search, resident_id, visitor_id } = req.query;

        let query = `
            SELECT 
                v.visit_id,
                v.entry_time,
                v.exit_time,
                v.status,
                r.resident_id,
                r.name AS resident_name,
                r.flat_no,
                r.phone AS resident_phone,
                vis.visitor_id,
                vis.name AS visitor_name,
                vis.phone AS visitor_phone,
                vis.vehicle_no,
                vis.purpose
            FROM visits v
            JOIN residents r ON v.resident_id = r.resident_id
            JOIN visitors vis ON v.visitor_id = vis.visitor_id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += " AND v.status = ?";
            params.push(status);
        }

        if (date) {
            query += " AND DATE(v.entry_time) = ?";
            params.push(date);
        }

        if (resident_id) {
            query += " AND v.resident_id = ?";
            params.push(resident_id);
        }

        if (visitor_id) {
            query += " AND v.visitor_id = ?";
            params.push(visitor_id);
        }

        if (search) {
            query += ` AND (
                r.name LIKE ? OR 
                r.flat_no LIKE ? OR 
                vis.name LIKE ? OR 
                vis.phone LIKE ? OR 
                vis.vehicle_no LIKE ? OR 
                vis.purpose LIKE ?
            )`;
            const term = `%${search}%`;
            params.push(term, term, term, term, term, term);
        }

        query += " ORDER BY v.entry_time DESC";

        const [rows] = await db.query(query, params);
        res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        console.error("Error fetching visits:", err);
        res.status(500).json({ success: false, message: "Failed to fetch visits", error: err.message });
    }
});

// GET /api/visits/:id - Retrieve single visit by ID with complete joined details
app.get("/api/visits/:id", async (req, res) => {
    try {
        const visitId = req.params.id;
        const [rows] = await db.query(`
            SELECT 
                v.visit_id,
                v.entry_time,
                v.exit_time,
                v.status,
                r.resident_id,
                r.name AS resident_name,
                r.flat_no,
                r.phone AS resident_phone,
                r.email AS resident_email,
                vis.visitor_id,
                vis.name AS visitor_name,
                vis.phone AS visitor_phone,
                vis.vehicle_no,
                vis.purpose
            FROM visits v
            JOIN residents r ON v.resident_id = r.resident_id
            JOIN visitors vis ON v.visitor_id = vis.visitor_id
            WHERE v.visit_id = ?
        `, [visitId]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: `Visit #${visitId} not found.` });
        }

        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error("Error fetching visit details:", err);
        res.status(500).json({ success: false, message: "Failed to fetch visit details", error: err.message });
    }
});

// POST /api/visits - Register visitor entry
// Supports:
// A) Selecting existing resident_id and existing visitor_id
// B) Or registering a new visitor inline (visitor_name, visitor_phone, vehicle_no, purpose)
app.post("/api/visits", async (req, res) => {
    try {
        let { resident_id, visitor_id, visitor_name, visitor_phone, vehicle_no, purpose } = req.body;

        if (!resident_id) {
            return res.status(400).json({ success: false, message: "Please select the resident being visited." });
        }

        // Verify resident exists
        const [resCheck] = await db.query("SELECT * FROM residents WHERE resident_id = ?", [resident_id]);
        if (resCheck.length === 0) {
            return res.status(404).json({ success: false, message: "Selected resident does not exist." });
        }

        // If visitor_id is not provided, create a new visitor record inline
        if (!visitor_id) {
            if (!visitor_name || !visitor_phone || !purpose) {
                return res.status(400).json({
                    success: false,
                    message: "Visitor Name, Phone, and Purpose are required to create a new visitor entry."
                });
            }

            const [visResult] = await db.query(
                "INSERT INTO visitors (name, phone, vehicle_no, purpose) VALUES (?, ?, ?, ?)",
                [visitor_name.trim(), visitor_phone.trim(), vehicle_no ? vehicle_no.trim().toUpperCase() : null, purpose.trim()]
            );
            visitor_id = visResult.insertId;
        } else {
            // Verify existing visitor
            const [vCheck] = await db.query("SELECT * FROM visitors WHERE visitor_id = ?", [visitor_id]);
            if (vCheck.length === 0) {
                return res.status(404).json({ success: false, message: "Specified visitor profile does not exist." });
            }
        }

        // Check if visitor is currently marked 'Inside' to avoid accidental double check-in
        const [activeVisit] = await db.query(
            "SELECT * FROM visits WHERE visitor_id = ? AND status = 'Inside'",
            [visitor_id]
        );
        if (activeVisit.length > 0) {
            return res.status(409).json({
                success: false,
                message: `This visitor is already checked in and marked 'Inside' (Visit #${activeVisit[0].visit_id}). Please check out their active visit before registering a new entry.`
            });
        }

        // Record entry: current timestamp, exit_time = NULL, status = 'Inside'
        const [visitResult] = await db.query(
            "INSERT INTO visits (resident_id, visitor_id, entry_time, exit_time, status) VALUES (?, ?, NOW(), NULL, 'Inside')",
            [resident_id, visitor_id]
        );

        res.status(201).json({
            success: true,
            message: "Visitor successfully registered and checked in!",
            visit_id: visitResult.insertId
        });
    } catch (err) {
        console.error("Error creating visit:", err);
        res.status(500).json({ success: false, message: "Failed to record visitor entry", error: err.message });
    }
});

// PUT /api/visits/:id/checkout - Fast Check-Out Action for Security Staff
app.put("/api/visits/:id/checkout", async (req, res) => {
    try {
        const visitId = req.params.id;

        const [existing] = await db.query("SELECT * FROM visits WHERE visit_id = ?", [visitId]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: `Visit #${visitId} not found.` });
        }

        const visit = existing[0];
        if (visit.status === "Completed") {
            return res.status(400).json({
                success: false,
                message: `Visit #${visitId} is already completed. Exit time was recorded on ${visit.exit_time}.`
            });
        }

        // Record exit_time as NOW() and status as Completed
        await db.query(
            "UPDATE visits SET exit_time = NOW(), status = 'Completed' WHERE visit_id = ?",
            [visitId]
        );

        res.json({
            success: true,
            message: `Visit #${visitId} marked as Completed. Visitor has checked out successfully.`
        });
    } catch (err) {
        console.error("Error during checkout:", err);
        res.status(500).json({ success: false, message: "Checkout failed", error: err.message });
    }
});

// PUT /api/visits/:id - Update visit details
app.put("/api/visits/:id", async (req, res) => {
    try {
        const visitId = req.params.id;
        const { resident_id, visitor_id, entry_time, exit_time, status } = req.body;

        const [existing] = await db.query("SELECT * FROM visits WHERE visit_id = ?", [visitId]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: `Visit #${visitId} not found.` });
        }

        const current = existing[0];
        const newResidentId = resident_id || current.resident_id;
        const newVisitorId = visitor_id || current.visitor_id;
        const newEntryTime = entry_time || current.entry_time;
        let newExitTime = exit_time !== undefined ? (exit_time === "" ? null : exit_time) : current.exit_time;
        let newStatus = status || current.status;

        // Validation: Exit time cannot be earlier than entry time
        if (newExitTime && new Date(newExitTime) < new Date(newEntryTime)) {
            return res.status(400).json({
                success: false,
                message: "Validation Error: Exit time cannot be earlier than entry time."
            });
        }

        // If status is marked Completed but no exit time provided, auto-set to NOW()
        if (newStatus === "Completed" && !newExitTime) {
            newExitTime = new Date().toISOString().slice(0, 19).replace("T", " ");
        }

        // If status is Inside, exit_time must be null
        if (newStatus === "Inside") {
            newExitTime = null;
        }

        await db.query(`
            UPDATE visits 
            SET resident_id = ?, visitor_id = ?, entry_time = ?, exit_time = ?, status = ?
            WHERE visit_id = ?
        `, [newResidentId, newVisitorId, newEntryTime, newExitTime, newStatus, visitId]);

        res.json({
            success: true,
            message: `Visit #${visitId} updated successfully.`
        });
    } catch (err) {
        console.error("Error updating visit:", err);
        res.status(500).json({ success: false, message: "Failed to update visit record", error: err.message });
    }
});

// DELETE /api/visits/:id - Delete a visit record
app.delete("/api/visits/:id", async (req, res) => {
    try {
        const visitId = req.params.id;

        const [existing] = await db.query("SELECT * FROM visits WHERE visit_id = ?", [visitId]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: `Visit record #${visitId} does not exist.` });
        }

        await db.query("DELETE FROM visits WHERE visit_id = ?", [visitId]);
        res.json({ success: true, message: `Visit record #${visitId} deleted successfully.` });
    } catch (err) {
        console.error("Error deleting visit:", err);
        res.status(500).json({ success: false, message: "Failed to delete visit record", error: err.message });
    }
});

// ==============================================================================
// 5. 404 & FALLBACK ROUTE
// ==============================================================================
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, "public", "index.html"));
});

// Start Server
app.listen(PORT, () => {
    console.log("=================================================");
    console.log(` GateNest Server is running live on:`);
    console.log(` http://localhost:${PORT}`);
    console.log("=================================================");
});
