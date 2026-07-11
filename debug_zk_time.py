"""Debug ZK attendances."""
from zk import ZK
from datetime import datetime

zk = ZK("192.168.0.201", port=4370, timeout=10)
try:
    print("Connecting to device...")
    conn = zk.connect()
    
    # Get time
    print(f"Device Time: {conn.get_time()}")
    
    print("Fetching attendances...")
    attendances = conn.get_attendance()
    print(f"Total attendances found: {len(attendances)}")
    
    if attendances:
        print("Last 10 attendances:")
        for att in attendances[-10:]:
            print(f"User: {att.user_id}, Time: {att.timestamp}")
            
except Exception as e:
    print(f"Error: {e}")
finally:
    try:
        zk.disconnect()
    except:
        pass
