import logging
import re

class PIIMaskingFilter(logging.Filter):
    def __init__(self, name=""):
        super().__init__(name)
        
        self.pan_pattern = re.compile(r'\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b')
        self.aadhaar_pattern = re.compile(r'\b\d{12}\b|\b\d{4}-\d{4}-\d{4}\b|\b\d{4} \d{4} \d{4}\b')
        self.email_pattern = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
        self.password_pattern = re.compile(r'(password=)[^\s]+')
        self.pin_pattern = re.compile(r'(pin=)[^\s]+')

    def filter(self, record):
        if isinstance(record.msg, str):
            record.msg = self.pan_pattern.sub('[PAN REDACTED]', record.msg)
            record.msg = self.aadhaar_pattern.sub('[AADHAAR REDACTED]', record.msg)
            record.msg = self.email_pattern.sub('[EMAIL REDACTED]', record.msg)
            record.msg = self.password_pattern.sub(r'\1[PASSWORD REDACTED]', record.msg)
            record.msg = self.pin_pattern.sub(r'\1[PIN REDACTED]', record.msg)
        return True
