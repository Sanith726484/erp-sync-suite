import frappe

def after_install():
    # Add custom fields on Company DocType
    custom_fields = [
        {
            "fieldname": "custom_mobile_app_icon",
            "label": "Custom Mobile App Icon",
            "fieldtype": "Attach Image",
            "insert_after": "company_logo"
        },
        {
            "fieldname": "custom_splash_screen_image",
            "label": "Custom Splash Screen Image",
            "fieldtype": "Attach Image",
            "insert_after": "custom_mobile_app_icon"
        }
    ]
    
    for field in custom_fields:
        if not frappe.db.exists("Custom Field", {"dt": "Company", "fieldname": field["fieldname"]}):
            df = frappe.new_doc("Custom Field")
            df.dt = "Company"
            df.fieldname = field["fieldname"]
            df.label = field["label"]
            df.fieldtype = field["fieldtype"]
            df.insert_after = field["insert_after"]
            df.insert(ignore_permissions=True)
            
    frappe.db.commit()
