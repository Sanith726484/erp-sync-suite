from setuptools import setup, find_packages

setup(
    name="erpnext_mobile",
    version="1.0.0",
    description="Frappe integration app for order booking, location logging, and route tracking.",
    author="Navtech",
    author_email="support@navtech.io",
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    install_requires=[]
)
