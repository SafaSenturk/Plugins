"""Tiny adb driver: python adb.py shot <file> | tap x y | swipe x1 y1 x2 y2 [ms] | text <s> | key <code> | wait <s>
Several commands can be chained with ' ; '."""
import subprocess, sys, os, time
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ADB = os.path.expandvars(r'%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe')
def run(*a, **k): return subprocess.run([ADB, *a], capture_output=True, **k)
def do(cmd):
    c, *a = cmd
    if c == 'shot':
        out = run('exec-out', 'screencap', '-p').stdout
        os.makedirs(os.path.dirname(os.path.abspath(a[0])), exist_ok=True)
        open(a[0], 'wb').write(out); print('saved', a[0], len(out))
    elif c == 'tap': run('shell', 'input', 'tap', *a)
    elif c == 'swipe': run('shell', 'input', 'swipe', *a)
    elif c == 'text': run('shell', 'input', 'text', a[0].replace('_', '%s'))
    elif c == 'key': run('shell', 'input', 'keyevent', *a)
    elif c == 'wait': time.sleep(float(a[0]))
    elif c == 'start': run('shell', 'am', 'start', '-n', a[0])
    elif c == 'stop': run('shell', 'am', 'force-stop', a[0])
    elif c == 'clear': run('shell', 'pm', 'clear', a[0])
    elif c == 'find':  # find <substring> [index]: tap the n-th node whose text/desc contains it
        import re, xml.etree.ElementTree as ET
        needle = a[0].replace('_', ' '); idx = int(a[1]) if len(a) > 1 else 0
        for _ in range(3):
            run('shell', 'uiautomator', 'dump', '/sdcard/ui.xml')
            xml = run('exec-out', 'cat', '/sdcard/ui.xml').stdout.decode('utf-8', 'ignore')
            hits = []
            for n in ET.fromstring(xml).iter('node'):
                label = (n.get('text') or '') + ' ' + (n.get('content-desc') or '') + ' ' + (n.get('hint') or '')
                if needle.lower() in label.lower():
                    x1, y1, x2, y2 = map(int, re.findall(r'\d+', n.get('bounds')))
                    hits.append(((x1 + x2) // 2, (y1 + y2) // 2, label.strip()))
            if len(hits) > idx: break
            time.sleep(1)
        else:
            raise SystemExit(f'not found: {needle} (have {len(hits)})')
        x, y, label = hits[idx]
        print('tap', x, y, repr(label[:40]))
        run('shell', 'input', 'tap', str(x), str(y))
    elif c == 'dump':
        import re, xml.etree.ElementTree as ET
        run('shell', 'uiautomator', 'dump', '/sdcard/ui.xml')
        xml = run('exec-out', 'cat', '/sdcard/ui.xml').stdout.decode('utf-8', 'ignore')
        for n in ET.fromstring(xml).iter('node'):
            label = ((n.get('text') or '') + ' | ' + (n.get('content-desc') or '')).strip(' |')
            if label: print(n.get('bounds'), label.replace(chr(10), ' ')[:70])
    else: raise SystemExit('unknown ' + c)
args = ' '.join(sys.argv[1:]).split(' ; ')
for cmd in args: do(cmd.split())
