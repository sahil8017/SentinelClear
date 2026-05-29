import urllib.request
import gzip

try:
    req = urllib.request.Request(
        'https://api.github.com/repos/sahil8017/SentinelClear/actions/jobs/78175615410/logs',
        headers={'Accept': 'application/vnd.github+json'}
    )
    with urllib.request.urlopen(req) as response:
        # It's a text log file, not gzip (unless we ask for zip)
        content = response.read().decode('utf-8')
        
        # print only the lines containing '❌' or 'Test' to see what failed
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if '❌' in line or 'test_everything.py' in line or 'RESULTS' in line:
                print(f"{i}: {line.strip()}")
                
        # Also print the section where '14. FRAUD RULE ENGINE' is tested
        capture = False
        for line in lines:
            if '14. FRAUD RULE ENGINE' in line:
                capture = True
                print("--- START 14 ---")
            if capture:
                print(line.strip())
                if '15.' in line:
                    capture = False
                    break
except Exception as e:
    print(f"Error: {e}")
