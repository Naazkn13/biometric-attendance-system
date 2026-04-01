"""Quick network scanner to find ZKTeco devices on port 4370."""
import socket
import concurrent.futures

def check(ip):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.3)
        if s.connect_ex((ip, 4370)) == 0:
            s.close()
            return ip
        s.close()
    except:
        pass
    return None

if __name__ == "__main__":
    print("Scanning 192.168.0.1-254 for ZKTeco (port 4370)...")
    ips = [f"192.168.0.{i}" for i in range(1, 255)]
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=100) as ex:
        results = list(ex.map(check, ips))
    
    found = [ip for ip in results if ip]
    if found:
        for ip in found:
            print(f"FOUND DEVICE: {ip}:4370")
    else:
        print("No devices found on port 4370")
    print("SCAN COMPLETE")
