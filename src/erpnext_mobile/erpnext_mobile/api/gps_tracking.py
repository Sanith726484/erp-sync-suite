import frappe
from frappe import _

@frappe.whitelist()
def save_gps_location(latitude, longitude):
    user = frappe.session.user
    if user == "Guest":
        frappe.throw(_("Not logged in"), frappe.PermissionError)
        
    # Create a new GPS Location Log
    doc = frappe.get_doc({
        "doctype": "GPS Location Log",
        "user": user,
        "latitude": latitude,
        "longitude": longitude,
        "timestamp": frappe.utils.now_datetime()
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    
    return {
        "status": "success",
        "message": _("GPS Location logged successfully")
    }
