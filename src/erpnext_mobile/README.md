# ERPNext Mobile Custom App

This is a custom Frappe application designed to integrate and synchronize mobile client features (location tracking, attendance check-ins, branding metadata) directly with an ERPNext instance.

## Features
* **Custom Doctypes**: Registers `GPS Location Log` and `Visit`.
* **Custom Fields**: Automatically inserts the custom fields on the `Company` Doctype for dynamic white-labeling:
  * `custom_mobile_app_icon` (Attach Image)
  * `custom_splash_screen_image` (Attach Image)
* **Whitelisted RPC API**: Exposes `/api/method/erpnext_mobile.api.gps_tracking.save_gps_location` for saving GPS location updates.

## Installation

1. Copy or clone this folder (`erpnext_mobile`) into your Bench's `apps/` directory, or pull it directly:
   ```bash
   bench get-app erpnext_mobile
   ```

2. Install the app onto your site:
   ```bash
   bench --site [your-site-name] install-app erpnext_mobile
   ```

3. Run site migrations to generate Doctypes and custom fields:
   ```bash
   bench --site [your-site-name] migrate
   ```
