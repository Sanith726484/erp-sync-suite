# ERPNext / Frappe Site Configuration Guide

To enable order booking, GPS location logs, and visit route tracking with this app suite, you need to configure a few Custom Doctypes and permissions on your Frappe/ERPNext site.

---

## 1. Custom Doctypes Setup

You need to create two custom Doctypes in your Frappe site (via the "DocType" list in the Desk).

### A. Doctype: `GPS Location Log`
This logs periodic location coordinates from the mobile app.

* **Fields**:
  1. **User** (`Link` -> `User`): The user being tracked.
  2. **Latitude** (`Float`): Latitude coordinate.
  3. **Longitude** (`Float`): Longitude coordinate.
  4. **Timestamp** (`Datetime`): Time of coordinate logging.
  5. **Distance from Previous** (`Float` or `Data`, Optional): Stores distance in km between this and the previous log point.

---

### B. Doctype: `Visit`
This logs employee check-in and check-out actions.

* **Fields**:
  1. **Customer** (`Link` -> `Customer`): The customer being visited.
  2. **Visit Type** (`Select`): Options include: `Client Meet & Site Visit`, `Maintenance`, `Order Collection`, `Follow-up`.
  3. **Date** (`Date`): Date of visit check-in.
  4. **Time** (`Time`): Time of visit check-in.
  5. **Latitude** (`Float`): Check-in latitude coordinate.
  6. **Longitude** (`Float`): Check-in longitude coordinate.
  7. **Description** (`Small Text`): Visit details or summary.
  8. **Status** (`Select`): Options: `Checked In`, `Checked Out`.
  9. **Checkout Latitude** (`Float`, Optional): Check-out latitude coordinate.
  10. **Checkout Longitude** (`Float`, Optional): Check-out longitude coordinate.

---

### C. Customize Doctype: `Company`
To enable dynamic, white-label branding in the web and mobile apps, customize the standard **Company** Doctype to add or ensure the following fields:

1. **Company Logo** (`Attach Image`, fieldname: `company_logo`): This is the standard ERPNext logo field.
2. **Mobile App Icon** (`Attach Image`, fieldname: `custom_mobile_app_icon`): Used as the mobile app icon and favicon.
3. **Splash Screen Image** (`Attach Image`, fieldname: `custom_splash_screen_image`): Rendered on the mobile app loader/boot state.

---

## 2. API & Server Scripts (Optional but Recommended)

For advanced tracking like distance calculation between logs, you can implement the following whitelisted server function. Place it in a custom app (e.g. `api.py`) or as a **Frappe Server Script** (type: `API`):

```python
import frappe
from frappe.utils import get_datetime
import math

@frappe.whitelist()
def save_gps_location(latitude, longitude):
    user = frappe.session.user
    if user == "Guest":
        frappe.throw("Authentication required", frappe.PermissionError)
        
    latitude = float(latitude)
    longitude = float(longitude)
    now = frappe.utils.now_datetime()
    
    # 1. Fetch the last log of today to calculate distance
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    last_log = frappe.db.get_value(
        "GPS Location Log",
        {"user": user, "timestamp": (">=", today_start)},
        ["latitude", "longitude", "name"],
        order_by="timestamp desc",
        as_dict=True
    )
    
    distance = 0.0
    if last_log:
        # Haversine distance calculation (in kilometers)
        lat1, lon1 = last_log.latitude, last_log.longitude
        lat2, lon2 = latitude, longitude
        
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = (math.sin(d_lat / 2) ** 2 + 
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * 
             math.sin(d_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        distance = 6371.0 * c # Earth radius km
        
    # 2. Insert new GPS Log
    new_log = frappe.get_doc({
        "doctype": "GPS Location Log",
        "user": user,
        "latitude": latitude,
        "longitude": longitude,
        "timestamp": now,
        "distance_from_previous": distance
    })
    new_log.insert(ignore_permissions=True)
    frappe.db.commit()
    
    return {"status": "success", "distance_logged": distance}
```

---

## 3. CORS Configuration

To allow the browser (standard-web dashboard) to make REST requests directly to your ERPNext domain, configure the site settings:

1. Open `common_site_config.json` or your site's `site_config.json`.
2. Add the `allow_cors` option targeting your web app URL:

```json
{
  "allow_cors": "http://localhost:5173"
}
```

Or allow all origins if it is a private network/trusted environment:

```json
{
  "allow_cors": "*"
}
```

---

## 4. User Role Permissions

Ensure the target User Roles (e.g., `Sales User`, `Employee`) have API read/write permissions for:
- `Customer`
- `Item`
- `Sales Order`
- `GPS Location Log`
- `Visit`

Go to **Role Permissions Manager** in ERPNext and assign permissions accordingly.
