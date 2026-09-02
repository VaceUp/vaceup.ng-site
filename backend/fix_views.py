with open('C:/Users/User/Downloads/vaceup/apps/adminpanel/views.py', 'r') as f:
    content = f.read()

content = content.replace(
    '        }\n\n    @action(detail=False, methods=["post"], url_path="staff/invite")',
    '        })\n\n    @action(detail=False, methods=["post"], url_path="staff/invite")'
)

with open('C:/Users/User/Downloads/vaceup/apps/adminpanel/views.py', 'w') as f:
    f.write(content)
print('Fixed')