import hmac
import hashlib

secret = b'sk_test_dummy'
raw = b'{"event": "charge.success", "data": {"reference": "unknown_ref"}}'
sig = hmac.new(secret, raw, hashlib.sha512).hexdigest()
print(sig)