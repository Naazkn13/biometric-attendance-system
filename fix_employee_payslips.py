import re

with open('frontend/src/app/payslips/page.js', 'r') as f:
    admin_content = f.read()

# Extract PayslipDetail function
match = re.search(r'function PayslipDetail.*', admin_content, re.DOTALL)
if not match:
    print("Could not find PayslipDetail in admin payslips")
    exit(1)
admin_payslip_detail = match.group(0)

with open('frontend/src/app/employee/payslips/page.js', 'r') as f:
    employee_content = f.read()

# Replace rendering logic
old_render = """            {selectedPayslip && (
                <div id="payslip-printable" style={{ ...cardStyle, padding: '32px' }}>
                    <PayslipDetail payslip={selectedPayslip} fmt={fmt} />
                </div>
            )}"""

new_render = """            {selectedPayslip && (
                <div id="payslip-printable" style={{ ...cardStyle, padding: '32px' }}>
                    <PayslipDetail 
                        payslip={{
                            ...selectedPayslip, 
                            employee_name: selectedPayslip.employees?.name || 'Employee',
                            device_user_id: selectedPayslip.employees?.device_user_id || selectedPayslip.employee_id.split('-')[0]
                        }} 
                        month={monthNames[new Date(selectedPayslip.period_start).getMonth()]}
                        year={new Date(selectedPayslip.period_start).getFullYear()}
                        fmt={fmt} 
                    />
                </div>
            )}"""
employee_content = employee_content.replace(old_render, new_render)

# Add @page margin: 0 to style
old_style = """                    #payslip-printable * { color: #000 !important; background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}</style>"""
new_style = """                    #payslip-printable * { color: #000 !important; background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    @page { margin: 0; size: A4; }
                }
            `}</style>"""
employee_content = employee_content.replace(old_style, new_style)

# Replace PayslipDetail function
employee_content = re.sub(r'function PayslipDetail.*', admin_payslip_detail, employee_content, flags=re.DOTALL)

with open('frontend/src/app/employee/payslips/page.js', 'w') as f:
    f.write(employee_content)

print("Employee payslips updated successfully")
