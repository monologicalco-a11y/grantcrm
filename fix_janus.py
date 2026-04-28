import re
with open('/usr/local/etc/janus/janus.jcfg', 'r') as f:
    data = f.read()

# Force strict RTP port range to match firewall rules
data = re.sub(r'#?rtp_port_range\s*=\s*".*"', 'rtp_port_range = "10000-20000"', data)

# Enable STUN for better candidate gathering
data = re.sub(r'#?stun_server\s*=\s*".*"', 'stun_server = "stun.l.google.com"', data)
data = re.sub(r'#?stun_port\s*=\s*[0-9]+', 'stun_port = 19302', data)

with open('/tmp/janus_new.jcfg', 'w') as f:
    f.write(data)
